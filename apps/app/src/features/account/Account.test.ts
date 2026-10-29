import { assert, describe, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Ref from "effect/Ref";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { AuthApiTesting } from "../../infra/auth/AuthApiTesting.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { DeviceSessions } from "../../infra/keychain/DeviceSessions.ts";
import { MemoryKeychain } from "../../infra/keychain/MemoryKeychain.ts";
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";
import { Account } from "./Account.ts";

const signedIn = (accountId: string, token: string): AuthApi.SignedIn => ({
  accountId,
  token: Redacted.make(token),
});

const store = SessionStore.layer.pipe(
  Layer.provide(DeviceSessions.layer),
  Layer.provide(MemoryKeychain.layer()),
  Layer.provide(Device.layer({ name: "phone", publicComputer: false })),
  Layer.provide(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
);

/** Lena's code was confirmed; her session waits for the passkey offer. */
const confirmed = (email: string, accountId: string, token: string) =>
  Effect.flatMap(Account.Confirmations, ({ current }) =>
    SubscriptionRef.set(current, Option.some({ email, signedIn: signedIn(accountId, token) })),
  );

/** A passkey dialog the test closes or completes, and the sessions the server was asked to end. */
class Passkey extends Context.Service<
  Passkey,
  {
    readonly dialog: Deferred.Deferred<"created" | "closed">;
    readonly revoked: Ref.Ref<ReadonlyArray<string>>;
  }
>()("Test.Passkey") {}

const passkeyDialog = Layer.effect(Passkey)(
  Effect.all({
    dialog: Deferred.make<"created" | "closed">(),
    revoked: Ref.make<ReadonlyArray<string>>([]),
  }),
);

const credential: AuthApi.Credential = {
  id: "credential",
  rawId: "credential",
  type: "public-key",
  response: {},
  clientExtensionResults: {},
};

const withPasskeyDialog = Layer.mergeAll(
  store,
  Account.confirmations,
  Layer.unwrap(
    Effect.map(Passkey, ({ dialog, revoked }) =>
      Layer.mergeAll(
        AuthApiTesting.layer({
          passkeyCreationOptions: () =>
            Effect.succeed({
              challenge: "challenge",
              options: {
                challenge: "challenge",
                rp: { name: "Studienbuch" },
                user: { id: "lena", name: "", displayName: "" },
                pubKeyCredParams: [],
              },
            }),
          addPasskey: () => Effect.void,
          signOut: (token) => Ref.update(revoked, (tokens) => [...tokens, Redacted.value(token)]),
        }),
        Layer.succeed(Passkeys.Authenticator)({
          create: () =>
            Effect.flatMap(Deferred.await(dialog), (answer) =>
              answer === "created"
                ? Effect.succeed({ credential, prf: Passkeys.CreatedPrf.Unsupported() })
                : Effect.fail(new Passkeys.Cancelled()),
            ),
          get: () => Effect.die("no sign-in was asked for"),
        }),
      ),
    ),
  ),
).pipe(Layer.provideMerge(passkeyDialog));

describe("Account", () => {
  it.effect("refuses another account while the device holds one whose session ended", () =>
    Effect.gen(function* () {
      const revoked = yield* Ref.make<ReadonlyArray<string>>([]);

      yield* Effect.gen(function* () {
        const sessions = yield* SessionStore.Service;

        yield* sessions.signedIn(signedIn("lena", "token-lena"));
        yield* sessions.ended;

        const refused = yield* Effect.flip(Account.signIn("tom@example.org", "geheim-genug"));

        assert.strictEqual(refused.reason, "other-account");
        assert.deepStrictEqual(yield* Ref.get(revoked), ["token-tom"]);
        assert.deepStrictEqual(
          Option.map(yield* sessions.current, (signed) => signed.accountId),
          Option.some("lena"),
        );

        yield* Account.signIn("lena@example.org", "geheim-genug");

        assert.isTrue(
          Option.isSome(Option.flatMap(yield* sessions.current, (signed) => signed.token)),
        );
      }).pipe(
        Effect.provide(
          Layer.merge(
            store,
            AuthApiTesting.layer({
              signIn: (email) =>
                Effect.succeed(
                  email.startsWith("tom")
                    ? signedIn("tom", "token-tom")
                    : signedIn("lena", "token-lena-2"),
                ),
              signOut: (token) =>
                Ref.update(revoked, (tokens) => [...tokens, Redacted.value(token)]),
            }),
          ),
        ),
      );
    }),
  );

  it.effect("signs out offline: the device forgets everything, and the session runs out", () =>
    Effect.gen(function* () {
      const forgotten = yield* Ref.make<ReadonlyArray<string>>([]);

      yield* Effect.gen(function* () {
        const sessions = yield* SessionStore.Service;

        yield* sessions.signedIn(signedIn("lena", "token-lena"));
        yield* Account.signOut((accountId) =>
          Ref.update(forgotten, (accounts) => [...accounts, accountId]),
        );

        assert.isTrue(Option.isNone(yield* sessions.current));
        assert.deepStrictEqual(yield* Ref.get(forgotten), ["lena"]);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            store,
            Account.confirmations,
            AuthApiTesting.layer({
              signOut: () => Effect.fail(new AuthApi.Unreachable({ cause: "offline" })),
            }),
          ),
        ),
      );
    }),
  );

  // Lena confirmed her code on a shared device and went back; Tom signs up next. The passkey offer
  // and "Später" must not sign the device in as Lena or put Tom's passkey on her account.
  it.effect("finishes only the confirmed session of the address on screen", () =>
    Effect.gen(function* () {
      const sessions = yield* SessionStore.Service;

      yield* confirmed("Lena@example.org", "lena", "token-lena");

      const refused = yield* Effect.flip(Account.finish("tom@example.org", true));

      assert.deepStrictEqual(refused, new Account.Problem({ reason: "failed" }));
      assert.isTrue(Option.isNone(yield* sessions.current));

      yield* Account.finish(" lena@example.org", false);

      assert.deepStrictEqual(
        Option.map(yield* sessions.current, (signed) => signed.accountId),
        Option.some("lena"),
      );
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          store,
          Account.confirmations,
          AuthApiTesting.layer({}),
          Layer.succeed(Passkeys.Authenticator)({
            create: () => Effect.die("no passkey was asked for"),
            get: () => Effect.die("no passkey was asked for"),
          }),
        ),
      ),
    ),
  );

  // "Passkey anlegen" or "Später", then back before it finished: the screen's unmount must not end
  // a session the device is about to keep, nor orphan a passkey the dialog is creating.
  it.effect("lets a back press wait for the passkey dialog it interrupts", () =>
    Effect.gen(function* () {
      const sessions = yield* SessionStore.Service;
      const { dialog, revoked } = yield* Passkey;

      yield* confirmed("lena@example.org", "lena", "token-lena");

      const finishing = yield* Effect.forkChild(Account.finish("lena@example.org", true), {
        startImmediately: true,
      });

      const leaving = yield* Effect.forkChild(Account.abandon("lena@example.org"), {
        startImmediately: true,
      });

      yield* Deferred.succeed(dialog, "created");
      yield* Fiber.join(finishing);
      yield* Fiber.join(leaving);

      assert.deepStrictEqual(yield* Ref.get(revoked), []);
      assert.deepStrictEqual(
        Option.map(
          Option.flatMap(yield* sessions.current, (signed) => signed.token),
          Redacted.value,
        ),
        Option.some("token-lena"),
      );
    }).pipe(Effect.provide(withPasskeyDialog)),
  );

  it.effect("ends the session when the dialog was closed and the screen went", () =>
    Effect.gen(function* () {
      const sessions = yield* SessionStore.Service;
      const { dialog, revoked } = yield* Passkey;

      yield* confirmed("lena@example.org", "lena", "token-lena");

      const finishing = yield* Effect.forkChild(Account.finish("lena@example.org", true), {
        startImmediately: true,
      });

      const leaving = yield* Effect.forkChild(Account.abandon("lena@example.org"), {
        startImmediately: true,
      });

      yield* Deferred.succeed(dialog, "closed");
      yield* Fiber.await(finishing);
      yield* Fiber.join(leaving);

      assert.deepStrictEqual(yield* Ref.get(revoked), ["token-lena"]);
      assert.isTrue(Option.isNone(yield* sessions.current));
    }).pipe(Effect.provide(withPasskeyDialog)),
  );

  it.effect("says the server failed rather than that the device is offline", () =>
    Effect.gen(function* () {
      const reasonFor = (error: AuthApi.Refused | AuthApi.Unreachable | AuthApi.ServerFailed) =>
        Effect.flip(Account.signIn("lena@example.org", "lange-genug-123")).pipe(
          Effect.map((problem) => problem.reason),
          Effect.provide(
            Layer.merge(store, AuthApiTesting.layer({ signIn: () => Effect.fail(error) })),
          ),
        );

      assert.deepStrictEqual(
        [
          yield* reasonFor(new AuthApi.Unreachable({ cause: "offline" })),
          yield* reasonFor(new AuthApi.ServerFailed({ cause: "HTTP 502" })),
        ],
        ["offline", "server-error"],
      );
    }),
  );

  // The gates read this. An ended session keeps the tabs and the way back to "Anmelden"; a device
  // without a server or keychain shows its diagnostics instead of crashing.
  it("tells a signed-in device from one whose session ended or that can't hold an account", () => {
    const signed = (token: Option.Option<string>) =>
      AsyncResult.success(
        Option.some({ accountId: "lena", token: Option.map(token, Redacted.make) }),
      );

    assert.deepStrictEqual(
      [
        AsyncResult.initial(),
        AsyncResult.fail("ServerOrigin.NoServer"),
        AsyncResult.success(Option.none()),
        signed(Option.some("token-lena")),
        signed(Option.none()),
      ].map(Account.access),
      ["loading", "unavailable", "signed-out", "signed-in", "ended"],
    );
  });
});
