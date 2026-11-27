import { Demo } from "@stu/api/Demo";
import { Keys } from "@stu/api/Keys";
import type { AccountKey } from "@stu/e2ee";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Schema from "effect/Schema";

import { Deadline } from "../../infra/api/Deadline.ts";

// The `Keys` RPC group and `Demo.rootKey` as the signed-in account. Every call needs the server, so
// each can fail with `Unreachable`. `layer` calls it over the RPC protocol; tests answer from memory.

export * as KeyServer from "./KeyServer.ts";

/** The server didn't answer: the device is offline, the server is down, or it didn't answer in time. */
export class Unreachable extends Schema.TaggedError<
  Unreachable,
  { readonly brand: unique symbol }
>()("KeyServer.Unreachable", {}) {}

export class Service extends Context.Service<
  Service,
  {
    readonly state: Effect.Effect<Keys.State, Unreachable | Keys.SignedOut>;
    readonly init: (
      record: AccountKey.Record,
      wrapper: Keys.Sealed,
    ) => Effect.Effect<
      void,
      Unreachable | Keys.SignedOut | Keys.ChainExists | Keys.KeysLost | Keys.Invalid
    >;
    /** `login` goes with a card's wrapper (`NotebookKeys.cardLogin`). */
    readonly addWrapper: (
      wrapper: Keys.Sealed,
      login: Option.Option<Redacted.Redacted>,
    ) => Effect.Effect<
      void,
      Unreachable | Keys.SignedOut | Keys.Invalid | Keys.Stale | Keys.NotFresh
    >;
    readonly fetchSeals: (
      method: Keys.Method,
    ) => Effect.Effect<Keys.Seals, Unreachable | Keys.SignedOut | Keys.TooManyAttempts>;
    /** The root key the server derives for a demo account (ADR 0027). None for any other account. */
    readonly demoRootKey: Effect.Effect<
      Option.Option<Redacted.Redacted<Uint8Array>>,
      Unreachable | Keys.SignedOut
    >;
  }
>()("KeyServer.Service") {}

const unreachable = { RpcClientError: () => Effect.fail(new Unreachable()) };

/** No answer within `Deadline.answerWithin` counts as none, so no key step waits forever. */
const inTime = Deadline.within(() => new Unreachable());

/** `Service` over the RPC protocol, which carries the session's token. */
export const layer = Layer.effect(Service)(
  Effect.gen(function* () {
    const client = yield* RpcClient.make(Keys.Rpcs.merge(Demo.Rpcs));

    return Service.of({
      state: client["Keys.state"]().pipe(Effect.catchTags({ ...unreachable }), inTime),
      init: (record, wrapper) =>
        client["Keys.init"]({ record, wrapper }).pipe(Effect.catchTags({ ...unreachable }), inTime),
      addWrapper: (wrapper, login) =>
        client["Keys.addWrapper"]({
          wrapper,
          login: Option.getOrUndefined(Option.map(login, Redacted.value)),
        }).pipe(Effect.catchTags({ ...unreachable }), inTime),
      fetchSeals: (method) =>
        client["Keys.fetchSeals"]({ method }).pipe(Effect.catchTags({ ...unreachable }), inTime),
      demoRootKey: client["Demo.rootKey"]().pipe(
        Effect.map(({ rootKey }) => Option.some(Redacted.make(rootKey))),
        Effect.catchTags({
          ...unreachable,
          "Demo.NotDemo": () => Effect.succeedNone,
          "Demo.SignedOut": () => Effect.fail(new Keys.SignedOut()),
        }),
        inTime,
      ),
    });
  }),
);
