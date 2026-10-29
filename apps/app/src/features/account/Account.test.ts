import { assert, describe, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Ref from "effect/Ref";

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
          Layer.merge(
            store,
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

      const lena = Option.some({
        email: "Lena@example.org",
        signedIn: signedIn("lena", "token-lena"),
      });

      const refused = yield* Effect.flip(Account.finish(lena, "tom@example.org", true));

      assert.deepStrictEqual(refused, new Account.Problem({ reason: "failed" }));
      assert.isTrue(Option.isNone(yield* sessions.current));

      yield* Account.finish(lena, " lena@example.org", false);

      assert.deepStrictEqual(
        Option.map(yield* sessions.current, (signed) => signed.accountId),
        Option.some("lena"),
      );
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          store,
          AuthApiTesting.layer({}),
          Layer.succeed(Passkeys.Authenticator)({
            create: () => Effect.die("no passkey was asked for"),
            get: () => Effect.die("no passkey was asked for"),
          }),
        ),
      ),
    ),
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
