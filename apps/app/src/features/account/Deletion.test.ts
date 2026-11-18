import { describe, expect, it } from "@effect/vitest";
import { AccountDeletion } from "@stu/api/AccountDeletion";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { AuthApiTesting } from "../../infra/auth/AuthApiTesting.ts";
import { layer as signUpStore } from "../../infra/auth/signUpStore.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { DeviceSessions } from "../../infra/keychain/DeviceSessions.ts";
import { MemoryKeychain } from "../../infra/keychain/MemoryKeychain.ts";
import { Account } from "./Account.ts";
import { Deletion } from "./Deletion.ts";
import { DeletionServer } from "./DeletionServer.ts";

/** One device, signed out, with nothing kept from before. */
const device = Layer.mergeAll(SessionStore.layer, Account.confirmations).pipe(
  Layer.provideMerge(Layer.mergeAll(DeviceSessions.layer, signUpStore)),
  Layer.provideMerge(MemoryKeychain.layer()),
  Layer.provideMerge(Device.layer({ name: "phone" })),
  Layer.provideMerge(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
  // The ended session's sign-out call fails like any other request after a deletion.
  Layer.provideMerge(AuthApiTesting.layer({ signOut: () => Effect.void })),
);

/** A server that deleted the accounts of `gone`, and whose `delete` behaves as `onDelete`. */
const server = (
  gone: ReadonlySet<string>,
  asked: Queue.Queue<string>,
  onDelete: DeletionServer.Service["Service"]["delete"] = () => Effect.void,
) =>
  Layer.succeed(DeletionServer.Service)({
    delete: onDelete,
    deleted: (token) =>
      Effect.as(Queue.offer(asked, Redacted.value(token)), gone.has(Redacted.value(token))),
  });

const signIn = (accountId: string, token: string) =>
  Effect.flatMap(SessionStore.Service, (store) =>
    store.signedIn({ accountId, token: Redacted.make(token), demo: false }, false),
  );

/**
 * The accounts the device left, and `forget`, a leave as sign-out's: it signs out with
 * `Account.signOut`, recording the account where the app's leave erases it.
 */
const forgetting = Effect.gen(function* () {
  const forgotten = yield* Ref.make<ReadonlyArray<string>>([]);

  const forget = Account.signOut(({ accountId }, forgetSession) =>
    Effect.andThen(
      Ref.update(forgotten, (accounts) => [...accounts, accountId]),
      forgetSession,
    ),
  );

  return { forgotten, forget };
});

describe("Deletion", () => {
  it.effect(
    "a device whose session ends because its account was deleted forgets it; any other end keeps it",
    () =>
      Effect.gen(function* () {
        const store = yield* SessionStore.Service;
        const asked = yield* Queue.unbounded<string>();
        const { forgotten, forget } = yield* forgetting;

        yield* Effect.gen(function* () {
          yield* Effect.forkChild(Deletion.forgetWhenDeleted(forget), { startImmediately: true });

          // Another device changed the password: this session ended, and the account lives on.
          yield* signIn("lena", "token-revoked");
          yield* store.ended;
          const askedFirst = yield* Queue.take(asked);
          const kept = yield* store.current;

          // Lena deleted her account on her phone, and this laptop comes back.
          yield* signIn("lena", "token-deleted");
          yield* store.ended;
          const askedThen = yield* Queue.take(asked);
          yield* Stream.runHead(Stream.filter(store.changes, Option.isNone));

          expect({
            asked: [askedFirst, askedThen],
            kept: Option.map(kept, (signed) => [signed.accountId, Option.isNone(signed.token)]),
            forgotten: yield* Ref.get(forgotten),
            now: yield* store.current,
          }).toEqual({
            asked: ["token-revoked", "token-deleted"],
            kept: Option.some(["lena", true]),
            forgotten: ["lena"],
            now: Option.none(),
          });
        }).pipe(Effect.provide(server(new Set(["token-deleted"]), asked)));
      }).pipe(Effect.provide(device)),
  );

  it.effect(
    "deleting here leaves the device signed out, though the server also ends this device's session",
    () =>
      Effect.gen(function* () {
        const store = yield* SessionStore.Service;
        const asked = yield* Queue.unbounded<string>();
        const { forgotten, forget } = yield* forgetting;

        // As the engine reports a closed connection, while the deletion's answer is on its way.
        const deleted = server(new Set(["token-phone"]), asked, () => store.ended);

        yield* Effect.gen(function* () {
          yield* Effect.forkChild(Deletion.forgetWhenDeleted(forget), { startImmediately: true });
          yield* signIn("lena", "token-phone");
          yield* Deletion.deleteAccount(forget);
          yield* Queue.take(asked);

          // The engines' turns make a second leave find nothing left to erase.
          expect({
            forgotten: [...new Set(yield* Ref.get(forgotten))],
            now: yield* store.current,
          }).toEqual({
            forgotten: ["lena"],
            now: Option.none(),
          });
        }).pipe(Effect.provide(deleted));
      }).pipe(Effect.provide(device)),
  );

  it.effect("a stale sign-in and no connection delete nothing and forget nothing", () =>
    Effect.gen(function* () {
      const asked = yield* Queue.unbounded<string>();
      const { forgotten, forget } = yield* forgetting;
      yield* signIn("lena", "token-phone");

      const refusals = yield* Effect.all([
        Effect.flip(
          Deletion.deleteAccount(forget).pipe(
            Effect.provide(
              server(new Set(), asked, () => Effect.fail(new AccountDeletion.NotFresh())),
            ),
          ),
        ),
        Effect.flip(
          Deletion.deleteAccount(forget).pipe(
            Effect.provide(
              server(new Set(), asked, () => Effect.fail(new DeletionServer.Unreachable())),
            ),
          ),
        ),
      ]);

      expect({
        reasons: refusals.map((error) =>
          error._tag === "Deletion.Problem" ? error.reason : error._tag,
        ),
        forgotten: yield* Ref.get(forgotten),
        signedIn: Option.isSome(yield* Effect.flatMap(SessionStore.Service, (s) => s.current)),
      }).toEqual({ reasons: ["not-fresh", "offline"], forgotten: [], signedIn: true });
    }).pipe(Effect.provide(device)),
  );
});
