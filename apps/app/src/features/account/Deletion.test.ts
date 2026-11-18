import { describe, expect, it } from "@effect/vitest";
import { AccountDeletion } from "@stu/api/AccountDeletion";
import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import { AuthApiTesting } from "../../infra/auth/AuthApiTesting.ts";
import { layer as signUpStore } from "../../infra/auth/signUpStore.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { DeviceSessions } from "../../infra/keychain/DeviceSessions.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { MemoryKeychain } from "../../infra/keychain/MemoryKeychain.ts";
import { Account } from "./Account.ts";
import { Deletion } from "./Deletion.ts";
import { DeletionServer } from "./DeletionServer.ts";

/** Arms the device's keychain to refuse its next read of the stored sessions. */
class Refuse extends Context.Service<Refuse, Ref.Ref<boolean>>()("Test.Refuse") {}

const keychain = Layer.effect(Keychain.Store)(
  Effect.gen(function* () {
    const store = yield* Keychain.Store;
    const refuse = yield* Refuse;

    return Keychain.Store.of({
      ...store,
      get: (name) =>
        name.startsWith("sessions.")
          ? Effect.flatMap(Ref.getAndSet(refuse, false), (now) =>
              now
                ? Effect.fail(new Keychain.Unavailable({ operation: "get", cause: "locked" }))
                : store.get(name),
            )
          : store.get(name),
    });
  }),
).pipe(
  Layer.provide(MemoryKeychain.layer()),
  Layer.provideMerge(Layer.effect(Refuse)(Ref.make(false))),
);

/** One device, signed out, with nothing kept from before. */
const device = Layer.mergeAll(SessionStore.layer, Account.confirmations).pipe(
  Layer.provideMerge(Layer.mergeAll(DeviceSessions.layer, signUpStore)),
  Layer.provideMerge(keychain),
  Layer.provideMerge(Device.layer({ name: "phone" })),
  Layer.provideMerge(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
  Layer.provideMerge(AuthApiTesting.layer({ signOut: () => Effect.void })),
);

type Server = DeletionServer.Service["Service"];

/**
 * A server that deleted the accounts of `gone`, telling `asked` each token it's asked about. Its
 * `delete` and `deleted` behave as `calls` says, if it says.
 */
const server = (
  gone: ReadonlySet<string>,
  asked: Queue.Queue<string>,
  calls: Partial<Server> = {},
) =>
  Layer.succeed(DeletionServer.Service)({
    delete: () => Effect.void,
    ...calls,
    deleted: (token) =>
      Effect.andThen(
        Queue.offer(asked, Redacted.value(token)),
        calls.deleted?.(token) ?? Effect.succeed(gone.has(Redacted.value(token))),
      ),
  });

const signIn = (accountId: string, token: string) =>
  Effect.flatMap(SessionStore.Service, (store) =>
    store.signedIn({ accountId, token: Redacted.make(token), demo: false }, false),
  );

/**
 * The accounts the device was told to leave, and `leave`, which acts as the app's does: it forgets
 * the account only while the device still holds it (`AccountEngine.forgetIfHeld`). `report` keeps
 * the reasons a deletion reported in `reported`.
 */
const leaving = Effect.gen(function* () {
  const left = yield* Ref.make<ReadonlyArray<string>>([]);
  const reported = yield* Ref.make<ReadonlyArray<Deletion.Reason>>([]);

  const leave = (accountId: string) =>
    Effect.gen(function* () {
      const store = yield* SessionStore.Service;
      yield* Ref.update(left, (accounts) => [...accounts, accountId]);

      if (Option.exists(yield* store.current, (signed) => signed.accountId === accountId)) {
        yield* Effect.orDie(store.forget);
      }
    });

  const report = (reason: Deletion.Reason) =>
    Ref.update(reported, (reasons) => [...reasons, reason]);

  return { left, leave, reported, report };
});

const holder = Effect.flatMap(SessionStore.Service, (store) =>
  Effect.map(
    store.current,
    Option.map((signed) => signed.accountId),
  ),
);

describe("Deletion", () => {
  it.effect(
    "a device whose session ends because its account was deleted forgets it; any other end keeps it",
    () =>
      Effect.gen(function* () {
        const store = yield* SessionStore.Service;
        const asked = yield* Queue.unbounded<string>();
        const { left, leave } = yield* leaving;

        yield* Effect.gen(function* () {
          yield* Effect.forkChild(Deletion.forgetWhenDeleted(leave), { startImmediately: true });

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
            left: yield* Ref.get(left),
            now: yield* store.current,
          }).toEqual({
            asked: ["token-revoked", "token-deleted"],
            kept: Option.some(["lena", true]),
            left: ["lena"],
            now: Option.none(),
          });
        }).pipe(Effect.provide(server(new Set(["token-deleted"]), asked)));
      }).pipe(Effect.provide(device)),
  );

  // The laptop's session ended while the app was closed. At the next start the session store
  // holds Lena with no token before the watcher runs, and only the device's keychain has it.
  it.effect(
    "a session that ended before the watcher started is checked with the stored token",
    () =>
      Effect.gen(function* () {
        const store = yield* SessionStore.Service;
        const asked = yield* Queue.unbounded<string>();
        const { left, leave } = yield* leaving;

        yield* signIn("lena", "token-stored");
        yield* store.ended;
        // The keychain still refuses the watcher's first read, as before the first unlock.
        yield* Ref.set(yield* Refuse, true);

        yield* Effect.gen(function* () {
          yield* Effect.forkChild(Deletion.forgetWhenDeleted(leave), { startImmediately: true });
          yield* TestClock.adjust("2 seconds");
          const question = yield* Queue.take(asked);
          yield* Stream.runHead(Stream.filter(store.changes, Option.isNone));

          expect({ question, left: yield* Ref.get(left) }).toEqual({
            question: "token-stored",
            left: ["lena"],
          });
        }).pipe(Effect.provide(server(new Set(["token-stored"]), asked)));
      }).pipe(Effect.provide(device)),
  );

  it.effect("a question the server didn't answer is asked again until it answers", () =>
    Effect.gen(function* () {
      const store = yield* SessionStore.Service;
      const asked = yield* Queue.unbounded<string>();
      const { left, leave } = yield* leaving;
      const tries = yield* Ref.make(0);

      // Offline twice, then the answer.
      const flaky = server(new Set(), asked, {
        deleted: () =>
          Effect.flatMap(
            Ref.updateAndGet(tries, (n) => n + 1),
            (n) => (n < 3 ? Effect.fail(new DeletionServer.Unreachable()) : Effect.succeed(true)),
          ),
      });

      yield* Effect.gen(function* () {
        yield* Effect.forkChild(Deletion.forgetWhenDeleted(leave), { startImmediately: true });
        yield* signIn("lena", "token-lena");
        yield* store.ended;
        yield* Queue.take(asked);
        yield* TestClock.adjust("2 seconds");
        yield* Queue.take(asked);
        yield* TestClock.adjust("4 seconds");
        yield* Queue.take(asked);
        yield* Stream.runHead(Stream.filter(store.changes, Option.isNone));

        expect({ tries: yield* Ref.get(tries), left: yield* Ref.get(left) }).toEqual({
          tries: 3,
          left: ["lena"],
        });
      }).pipe(Effect.provide(flaky));
    }).pipe(Effect.provide(device)),
  );

  // Lena deletes her account, and the answer is slow. Meanwhile she signs out and Tom signs in on
  // the same phone. The late answers concern Lena only, and Tom's session stays.
  it.effect(
    "late answers about a deleted account never touch the account the device holds now",
    () =>
      Effect.gen(function* () {
        const store = yield* SessionStore.Service;
        const asked = yield* Queue.unbounded<string>();
        const { left, leave, report } = yield* leaving;
        const deleting = yield* Deferred.make<void>();
        const answer = yield* Deferred.make<void>();

        const slow = server(new Set(["token-lena"]), asked, {
          delete: () =>
            Effect.andThen(Deferred.succeed(deleting, undefined), Deferred.await(answer)),
          deleted: () => Effect.as(Deferred.await(answer), true),
        });

        yield* Effect.gen(function* () {
          yield* Effect.forkChild(Deletion.forgetWhenDeleted(leave), { startImmediately: true });
          yield* signIn("lena", "token-lena");
          const deletion = yield* Effect.forkChild(Deletion.deleteAccount(leave, report));
          yield* Deferred.await(deleting);

          // Her session ends too, and the watcher's question waits for the same slow server.
          yield* store.ended;
          yield* Queue.take(asked);

          yield* store.forget;
          yield* signIn("tom", "token-tom");
          yield* Deferred.succeed(answer, undefined);
          yield* Fiber.join(deletion);

          expect({ left: yield* Ref.get(left), holder: yield* holder }).toEqual({
            left: ["lena"],
            holder: Option.some("tom"),
          });
        }).pipe(Effect.provide(slow));
      }).pipe(Effect.provide(device)),
  );

  // Lena's deletion waits for a server that then can't be reached; meanwhile Tom signs in on the
  // phone. The failure is Lena's, so Tom's screen shows nothing of it.
  it.effect("a deletion that fails after another account signed in reports nothing to it", () =>
    Effect.gen(function* () {
      const store = yield* SessionStore.Service;
      const asked = yield* Queue.unbounded<string>();
      const { leave, reported, report } = yield* leaving;
      const deleting = yield* Deferred.make<void>();
      const answer = yield* Deferred.make<void>();

      const unreachable = Effect.fail(new DeletionServer.Unreachable());

      const slow = server(new Set(), asked, {
        delete: () =>
          Effect.andThen(
            Effect.andThen(Deferred.succeed(deleting, undefined), Deferred.await(answer)),
            unreachable,
          ),
      });

      yield* Effect.gen(function* () {
        yield* signIn("lena", "token-lena");

        const deletion = yield* Effect.forkChild(
          Effect.flip(Deletion.deleteAccount(leave, report)),
        );

        yield* Deferred.await(deleting);
        yield* store.forget;
        yield* signIn("tom", "token-tom");
        yield* Deferred.succeed(answer, undefined);
        const lenas = yield* Fiber.join(deletion);
        const forTom = yield* Ref.get(reported);

        const toms = yield* Effect.flip(Deletion.deleteAccount(leave, report));

        expect({
          lenas: lenas.reason,
          forTom,
          toms: toms.reason,
          after: yield* Ref.get(reported),
        }).toEqual({ lenas: "offline", forTom: [], toms: "offline", after: ["offline"] });
      }).pipe(Effect.provide(slow));
    }).pipe(Effect.provide(device)),
  );

  it.effect(
    "deleting here leaves the device signed out, though the server also ends this device's session",
    () =>
      Effect.gen(function* () {
        const store = yield* SessionStore.Service;
        const asked = yield* Queue.unbounded<string>();
        const { left, leave, report } = yield* leaving;

        // As the engine reports a closed connection, while the deletion's answer is on its way. The
        // watcher's question about the ended session stops once Lena no longer holds the device.
        const deleted = server(new Set(["token-phone"]), asked, { delete: () => store.ended });

        yield* Effect.gen(function* () {
          yield* Effect.forkChild(Deletion.forgetWhenDeleted(leave), { startImmediately: true });
          yield* signIn("lena", "token-phone");
          yield* Deletion.deleteAccount(leave, report);

          expect({
            left: [...new Set(yield* Ref.get(left))],
            now: yield* store.current,
          }).toEqual({
            left: ["lena"],
            now: Option.none(),
          });
        }).pipe(Effect.provide(deleted));
      }).pipe(Effect.provide(device)),
  );

  // The server deleted Lena's account, but its answer got lost, so the screen still shows the
  // button. Pressed again, the server no longer knows her session.
  it.effect(
    "a deletion asked again after a lost answer leaves the device; an expired session doesn't",
    () =>
      Effect.gen(function* () {
        const asked = yield* Queue.unbounded<string>();
        const { left, leave, report } = yield* leaving;
        const signedOut = { delete: () => Effect.fail(new AccountDeletion.SignedOut()) };

        yield* signIn("lena", "token-gone");
        yield* Deletion.deleteAccount(leave, report).pipe(
          Effect.provide(server(new Set(["token-gone"]), asked, signedOut)),
        );
        const afterLostAnswer = yield* Ref.get(left);

        yield* signIn("tom", "token-expired");

        const expired = yield* Effect.flip(
          Deletion.deleteAccount(leave, report).pipe(
            Effect.provide(server(new Set(), asked, signedOut)),
          ),
        );

        expect({
          afterLostAnswer,
          expired: expired._tag === "Deletion.Problem" ? expired.reason : expired._tag,
          left: yield* Ref.get(left),
        }).toEqual({ afterLostAnswer: ["lena"], expired: "signed-out", left: ["lena"] });
      }).pipe(Effect.provide(device)),
  );

  it.effect("a stale sign-in and no connection delete nothing and forget nothing", () =>
    Effect.gen(function* () {
      const asked = yield* Queue.unbounded<string>();
      const { left, leave, report } = yield* leaving;
      yield* signIn("lena", "token-phone");

      const refusals = yield* Effect.all([
        Effect.flip(
          Deletion.deleteAccount(leave, report).pipe(
            Effect.provide(
              server(new Set(), asked, {
                delete: () => Effect.fail(new AccountDeletion.NotFresh()),
              }),
            ),
          ),
        ),
        Effect.flip(
          Deletion.deleteAccount(leave, report).pipe(
            Effect.provide(
              server(new Set(), asked, {
                delete: () => Effect.fail(new DeletionServer.Unreachable()),
              }),
            ),
          ),
        ),
      ]);

      expect({
        reasons: refusals.map((error) =>
          error._tag === "Deletion.Problem" ? error.reason : error._tag,
        ),
        left: yield* Ref.get(left),
        holder: yield* holder,
      }).toEqual({ reasons: ["not-fresh", "offline"], left: [], holder: Option.some("lena") });
    }).pipe(Effect.provide(device)),
  );
});
