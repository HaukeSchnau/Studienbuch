/**
 * The `Keys` RPC group, for the signed-in account only. Every server answers it, demo accounts
 * included, whose chain the demo seed published.
 */
import { Keys } from "@stu/api/Keys";
import { CryptoSuite, Wrapper } from "@stu/e2ee";
import { Ports } from "@stu/sync/server";
import * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { KeyStore } from "./KeyStore.ts";

export * as KeyCalls from "./KeyCalls.ts";

export const handlers = Keys.Rpcs.toLayer(
  Effect.gen(function* () {
    const sessions = yield* Ports.SessionResolver;
    const sql = yield* SqlClient.SqlClient;

    const caller = Effect.fn("KeyCalls.caller")(function* (headers: Headers.Headers) {
      const session = yield* sessions.resolve(headers);

      if (Option.isNone(session)) return yield* new Keys.SignedOut();

      return session.value;
    });

    // A failing database fails the call as a defect, without a reason the device could act on.
    return Keys.Rpcs.of({
      "Keys.state": Effect.fn("KeyCalls.state")(
        function* (_, { headers }) {
          return yield* KeyStore.state((yield* caller(headers)).accountId);
        },
        Effect.catchTags({ SqlError: Effect.die }),
      ),
      "Keys.init": Effect.fn("KeyCalls.init")(
        function* ({ record, wrapper }, { headers }) {
          const session = yield* caller(headers);

          // A first device unlocks with its own wrapper; passkeys and cards follow through
          // `addWrapper`, which checks the sign-in's age.
          if (wrapper.statement.kind !== Wrapper.kindByte.device) {
            return yield* new Keys.Invalid({ reason: "statement" });
          }

          yield* sql.withTransaction(
            KeyStore.publishFirst(session.accountId, record, Option.some(wrapper)),
          );
        },
        Effect.catchTags({ SqlError: Effect.die }),
      ),
      "Keys.addWrapper": Effect.fn("KeyCalls.addWrapper")(
        function* ({ wrapper }, { headers }) {
          const session = yield* caller(headers);

          yield* KeyStore.addWrapper(session.accountId, session.sessionId, wrapper);
        },
        Effect.catchTags({ SqlError: Effect.die }),
      ),
      "Keys.fetchSeals": Effect.fn("KeyCalls.fetchSeals")(
        function* ({ method }, { headers }) {
          return yield* KeyStore.fetchSeals((yield* caller(headers)).accountId, method);
        },
        Effect.catchTags({ SqlError: Effect.die }),
      ),
    });
  }),
).pipe(Layer.provide(CryptoSuite.layer));
