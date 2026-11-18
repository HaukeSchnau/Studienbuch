import { assert, describe, it } from "@effect/vitest";
import { Access } from "@stu/api/Access";
import { Accounts } from "@stu/api/Accounts";
import { RecoveryCode } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Ref from "effect/Ref";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { AuthApiTesting } from "../../infra/auth/AuthApiTesting.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { layer as signUpStore } from "../../infra/auth/signUpStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { DeviceSessions } from "../../infra/keychain/DeviceSessions.ts";
import { PendingSignUp } from "../../infra/auth/PendingSignUp.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { MemoryKeychain } from "../../infra/keychain/MemoryKeychain.ts";
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";
import { Forgetting } from "../../infra/runtime/Forgetting.ts";
import { NotebookKeys } from "../keys/NotebookKeys.ts";
import { Account } from "./Account.ts";

const signedIn = (accountId: string, token: string): AuthApi.SignedIn => ({
  accountId,
  token: Redacted.make(token),
});

const server = Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") });
const phone = Device.layer({ name: "phone" });

/** A device that left no sign-out unfinished and runs none. */
const nothingUnfinished = Layer.succeed(Forgetting.Service)({ keep: (session) => session });

const store = Layer.merge(
  SessionStore.layer.pipe(
    Layer.provide(DeviceSessions.layer),
    Layer.provide(MemoryKeychain.layer()),
    Layer.provide(phone),
    Layer.provide(server),
  ),
  nothingUnfinished,
);

/** One run of the app on a device whose keychain is `keychain`, so a test can restart it. */
const confirmations = (keychain: Layer.Layer<Keychain.Store> = MemoryKeychain.layer()) =>
  Account.confirmations.pipe(
    Layer.provideMerge(signUpStore),
    Layer.provideMerge(Layer.mergeAll(keychain, phone, server)),
  );

const reservation = (expiresAt: string) =>
  new Access.Reservation({
    token: "am-see",
    schoolName: "Demoschule am Wiesengrund",
    kind: "student",
    expiresAt: DateTime.makeUnsafe(expiresAt),
  });

// `it.effect`'s clock starts at 1970-01-01, and a reservation lasts two hours.
const soon = reservation("1970-01-01T02:00:00Z");
const later = reservation("1970-01-01T04:00:00Z");

/** Runs of the app on one device: each starts with empty memory and the same keychain. */
const restarts = Effect.map(
  Effect.provide(Keychain.Store, MemoryKeychain.layer()),
  (keychain) =>
    <A, E, R>(effect: Effect.Effect<A, E, R>, api: Layer.Layer<AuthApi.Service>) =>
      effect.pipe(
        Effect.provide(
          Layer.mergeAll(store, api, confirmations(Layer.succeed(Keychain.Store)(keychain))),
        ),
      ),
);

/** The sign-up a run found waiting: address, reservation, and whether it holds the password. */
const kept = Account.Confirmations.use(({ signingUp }) =>
  Effect.map(
    SubscriptionRef.get(signingUp),
    Option.map((waiting) => [
      waiting.email,
      waiting.reservation.token,
      Option.isSome(waiting.password),
    ]),
  ),
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

const creation: AuthApi.CreationOptions = {
  challenge: "challenge",
  rp: { name: "Studienbuch" },
  user: { id: "lena", name: "", displayName: "" },
  pubKeyCredParams: [],
};

const withPasskeyDialog = Layer.mergeAll(
  store,
  confirmations(),
  Layer.unwrap(
    Effect.map(Passkey, ({ dialog, revoked }) =>
      Layer.mergeAll(
        AuthApiTesting.layer({
          passkeyCreationOptions: () =>
            Effect.succeed({ challenge: "challenge", options: creation }),
          addPasskey: () => Effect.void,
          signOut: (token) => Ref.update(revoked, (tokens) => [...tokens, Redacted.value(token)]),
        }),
        Layer.succeed(Passkeys.Authenticator)({
          available: Effect.succeed(true),
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

        yield* sessions.signedIn({ ...signedIn("lena", "token-lena"), demo: false }, false);
        yield* sessions.ended;

        const refused = yield* Effect.flip(
          Account.signIn("tom@example.org", "geheim-genug", false),
        );

        assert.strictEqual(refused.reason, "other-account");
        assert.deepStrictEqual(yield* Ref.get(revoked), ["token-tom"]);
        assert.deepStrictEqual(
          Option.map(yield* sessions.current, (signed) => signed.accountId),
          Option.some("lena"),
        );

        yield* Account.signIn("lena@example.org", "geheim-genug", false);

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

  // A sign-out stopped after its point of no return, so its note stays. The next session waits
  // until what the account left is gone, or the device would start it on half-deleted data.
  it.effect("keeps a new session only once the sign-out the device left unfinished finished", () =>
    Effect.gen(function* () {
      const tries = yield* Ref.make(0);

      const finish = Effect.flatMap(
        Ref.updateAndGet(tries, (count) => count + 1),
        (count) =>
          count === 1
            ? Effect.fail(new Forgetting.Unfinished({ cause: "keychain locked" }))
            : Effect.void,
      );

      yield* Effect.gen(function* () {
        const sessions = yield* SessionStore.Service;

        const refused = yield* Effect.flip(Account.keep(signedIn("lena", "token-lena"), false));

        assert.strictEqual(refused.reason, "failed");
        assert.isTrue(Option.isNone(yield* sessions.current));

        yield* Account.keep(signedIn("lena", "token-lena"), false);

        assert.deepStrictEqual(
          Option.map(yield* sessions.current, (signed) => signed.accountId),
          Option.some("lena"),
        );
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            store,
            AuthApiTesting.layer({}),
            Layer.succeed(Forgetting.Service)({
              keep: (session) => Effect.andThen(finish, session),
            }),
          ),
        ),
      );
    }),
  );

  // A reload, or the OS ending the app, between sign-up and code. The device kept the address and
  // the code's reservation, never the password, which the code screen asks for again.
  it.effect("keeps a sign-up's address and reservation across a restart, never its password", () =>
    Effect.gen(function* () {
      const sent = yield* Ref.make<ReadonlyArray<string>>([]);
      const run = yield* restarts;

      const api = AuthApiTesting.layer({
        signUp: () => Effect.void,
        confirmEmail: (email, _code, password, reservation) =>
          // The server takes only a password a sign-up of the address chose (D88).
          Redacted.value(password).endsWith("-typo")
            ? Effect.fail(new AuthApi.Refused({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }))
            : Effect.as(
                Ref.update(sent, (made) => [
                  ...made,
                  `${email} ${Redacted.value(password)} ${Option.getOrElse(reservation, () => "none")}`,
                ]),
                signedIn(email, `token-${email}`),
              ),
      });

      // Lena signs up and confirms in one run, with the password she signed up with.
      const lena = yield* run(
        Effect.gen(function* () {
          const before = yield* kept;

          yield* Account.signUp("Lena@example.org ", "lenas-passwort-123", soon);
          yield* Account.confirmEmail("lena@example.org", "123 456");

          return before;
        }),
        api,
      );

      // Tom signs up, and the app restarts before his code.
      const tom = yield* run(
        Effect.gen(function* () {
          const before = yield* kept;

          yield* Account.signUp("tom@example.org", "toms-passwort-456", soon);

          return before;
        }),
        api,
      );

      const restarted = yield* run(
        Effect.gen(function* () {
          const before = yield* kept;
          const asked = yield* Effect.flip(Account.confirmEmail("tom@example.org", "654321"));

          const typo = yield* Effect.flip(
            Account.confirmEmail("tom@example.org", "654321", Option.some("toms-passwort-typo")),
          );

          yield* Account.confirmEmail(
            "tom@example.org",
            "654321",
            Option.some("toms-passwort-456"),
          );

          return { before, asked: asked.reason, typo: typo.reason };
        }),
        api,
      );

      const afterwards = yield* run(kept, api);

      assert.deepStrictEqual(
        [lena, tom, restarted, afterwards, yield* Ref.get(sent)],
        [
          Option.none(),
          Option.none(),
          {
            before: Option.some(["tom@example.org", "am-see", false]),
            asked: "password-needed",
            typo: "password-mismatch",
          },
          Option.none(),
          [
            "lena@example.org lenas-passwort-123 am-see",
            "tom@example.org toms-passwort-456 am-see",
          ],
        ],
      );
    }),
  );

  // The server would answer some of these with an error of its own, and one not at all.
  it.effect("refuses an address that can't be one before asking the server", () =>
    Effect.gen(function* () {
      const run = yield* restarts;
      const api = AuthApiTesting.layer({});

      const addresses = ["lena.qa-t1", "lena@", "lena@example"];

      const reason = <A, R>(effect: Effect.Effect<A, Account.Problem, R>) =>
        Effect.map(Effect.flip(effect), (problem) => problem.reason);

      const refused = yield* run(
        Effect.forEach(addresses, (email) =>
          Effect.all([
            reason(Account.signUp(email, "lenas-passwort-123", soon)),
            reason(Account.requestPasswordReset(email)),
          ]),
        ),
        api,
      );

      assert.deepStrictEqual(
        refused,
        addresses.map(() => ["invalid-email", "invalid-email"]),
      );
    }),
  );

  // The card of an account without an address is its login: what the device derives at sign-up
  // and from the typed code must be the one login, as @stu/e2ee's vector fixes it.
  it.effect(
    "signs up and in with one card's login, the same again after a lost answer, never after a typo",
    () =>
      Effect.gen(function* () {
        const phoneRun = yield* restarts;
        const laptopRun = yield* restarts;
        const sent = yield* Ref.make<ReadonlyArray<string>>([]);
        const answerLost = yield* Ref.make(true);
        const offered = yield* Ref.make<ReadonlyArray<Account.OfferedCard>>([]);

        // @stu/e2ee's vector: this card's login, as base64url.
        const vector = "J28S-54WM-JPB9-F64S-KADS-S7CY-KYH1";
        const vectorLogin = "rmMlHESFSnLQ6y0e56cl3gZWyYyFnnHJUv2o-wd_U5I";
        const unknown = RecoveryCode.text(Redacted.make(new Uint8Array(16).fill(7)));

        const api = AuthApiTesting.layer({
          cardSignUp: (login) =>
            Effect.andThen(
              Ref.update(sent, (all) => [...all, `sign-up ${Redacted.value(login)}`]),
              Effect.flatMap(Ref.getAndSet(answerLost, false), (lost) =>
                lost
                  ? Effect.fail(new AuthApi.Unreachable({ cause: "answer lost" }))
                  : Effect.succeed(signedIn(`noa-${Redacted.value(login)}`, "noa-1")),
              ),
            ),
          cardSignIn: (login) =>
            Effect.andThen(
              Ref.update(sent, (all) => [...all, `sign-in ${Redacted.value(login)}`]),
              Redacted.value(login) === vectorLogin
                ? Effect.succeed(signedIn("mia", "mia-1"))
                : Effect.fail(new AuthApi.Refused({ status: 401, code: Accounts.unknownCard })),
            ),
        });

        const offer = (card: Option.Option<Account.OfferedCard>) =>
          Option.match(card, {
            onNone: () => Effect.void,
            onSome: (each) => Ref.update(offered, (all) => [...all, each]),
          });

        const reason = <A, R>(
          effect: Effect.Effect<A, Account.Problem | NotebookKeys.Problem, R>,
        ) => Effect.map(Effect.flip(effect), (problem) => problem.reason);

        const signUp = Account.signUpWithCard(soon, false, offer);

        /** The card a sign-up left in the signed-in account's secrets on this device. */
        const keptCard = Effect.flatMap(
          SessionStore.Service.use((each) => each.current),
          (signed) =>
            Option.match(signed, {
              onNone: () => Effect.succeedNone,
              onSome: ({ accountId }) =>
                Effect.provide(NotebookKeys.pendingCard, Keychain.accountSecrets(accountId)),
            }),
        );

        // The answer is lost, and the app closes before the student tries again.
        const lost = yield* phoneRun(reason(signUp), api);

        // After a restart, with the access code redeemed again.
        const [holder, kept] = yield* phoneRun(
          Effect.andThen(
            Account.signUpWithCard(later, false, offer),
            Effect.all([SessionStore.Service.use((each) => each.current), keptCard]),
          ),
          api,
        );

        // The next sign-up on this device makes a card of its own.
        yield* phoneRun(Account.signUpWithCard(later, false, offer), api);

        // A public computer keeps nothing on disk, so its card goes through memory.
        const kioskRun = yield* restarts;

        const publicKept = yield* kioskRun(
          Effect.andThen(Account.signUpWithCard(later, true, offer), keptCard),
          api,
        );

        const laptop = yield* laptopRun(
          Effect.all({
            typo: reason(Account.signInWithCard(`${vector.slice(0, -1)}2`, false, offer)),
            short: reason(Account.signInWithCard(vector.slice(0, 20), false, offer)),
            unknown: reason(Account.signInWithCard(Redacted.value(unknown), false, offer)),
            typed: Account.signInWithCard(vector.toLowerCase().replaceAll("-", " "), false, offer),
          }),
          api,
        );

        const [first, retry, next] = yield* Ref.get(sent);
        const cards = yield* Ref.get(offered);

        const keptLogin = Option.match(kept, {
          onNone: () => Effect.succeed(""),
          onSome: (card) => Effect.map(NotebookKeys.cardLogin(card.code), Redacted.value),
        });

        assert.deepStrictEqual(
          {
            lost,
            retriedWithSameLogin: first !== undefined && first === retry,
            nextHasItsOwn: next !== undefined && next !== retry,
            kept: Option.map(kept, (card) => [card.withPasskey, card.unsaved]),
            publicKept: Option.isSome(publicKept),
            offered: cards.map((card) => card.unsaved),
            holder: Option.map(holder, (signed) => signed.accountId),
            laptop,
            signIns: (yield* Ref.get(sent)).filter((each) => each.startsWith("sign-in")).length,
          },
          {
            lost: "offline",
            retriedWithSameLogin: true,
            nextHasItsOwn: true,
            kept: Option.some([false, true]),
            publicKept: false,
            // The key status hears of every card: the phone's two and the public computer's new
            // ones, and the one the laptop signed in with.
            offered: [true, true, true, false],
            holder: Option.some(`noa-${yield* keptLogin}`),
            laptop: { typo: "typo", short: "length", unknown: "unknown-card", typed: "mia" },
            // The typo and the short code never left the device.
            signIns: 2,
          },
        );
      }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  it.effect("forgets a kept sign-up when its reservation expires, and when it's cancelled", () =>
    Effect.gen(function* () {
      const run = yield* restarts;
      const api = AuthApiTesting.layer({ signUp: () => Effect.void });
      const stored = PendingSignUp.Store.use((entry) => entry.get);

      yield* run(Account.signUp("lena@example.org", "lenas-passwort-123", soon), api);

      const withinTwoHours = yield* run(kept, api);

      yield* TestClock.adjust("2 hours");

      const expired = yield* run(Effect.all([kept, stored]), api);

      yield* run(Account.signUp("lena@example.org", "lenas-passwort-123", later), api);
      yield* run(Account.cancelSignUp, api);

      const cancelled = yield* run(Effect.all([kept, stored]), api);

      assert.deepStrictEqual(
        [withinTwoHours, expired, cancelled],
        [
          Option.some(["lena@example.org", "am-see", false]),
          [Option.none(), Option.none()],
          [Option.none(), Option.none()],
        ],
      );
    }),
  );

  it.effect("signs out offline: the device forgets everything, and the session runs out", () =>
    Effect.gen(function* () {
      const forgotten = yield* Ref.make<ReadonlyArray<string>>([]);

      yield* Effect.gen(function* () {
        const sessions = yield* SessionStore.Service;

        yield* sessions.signedIn({ ...signedIn("lena", "token-lena"), demo: false }, false);
        yield* Account.signOut(({ accountId }, forgetSession) =>
          Effect.andThen(
            Ref.update(forgotten, (accounts) => [...accounts, accountId]),
            forgetSession,
          ),
        );

        assert.isTrue(Option.isNone(yield* sessions.current));
        assert.deepStrictEqual(yield* Ref.get(forgotten), ["lena"]);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            store,
            confirmations(),
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

      const refused = yield* Effect.flip(Account.finish("tom@example.org", true, false));

      assert.deepStrictEqual(refused, new Account.Problem({ reason: "failed" }));
      assert.isTrue(Option.isNone(yield* sessions.current));

      yield* Account.finish(" lena@example.org", false, false);

      assert.deepStrictEqual(
        Option.map(yield* sessions.current, (signed) => signed.accountId),
        Option.some("lena"),
      );
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          store,
          confirmations(),
          AuthApiTesting.layer({}),
          Layer.succeed(Passkeys.Authenticator)({
            available: Effect.succeed(true),
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

      const finishing = yield* Effect.forkChild(Account.finish("lena@example.org", true, false), {
        startImmediately: true,
      });

      const leaving = yield* Effect.forkChild(Account.leave("lena@example.org", false), {
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

  // The dialog was closed and the screen went without "Später": the student meant to go on, and only
  // a public computer must leave nobody signed in for the next person.
  it.effect("keeps the session when the screen went, and ends it on a public computer", () =>
    Effect.gen(function* () {
      const leaveAfterClosedDialog = (publicComputer: boolean) =>
        Effect.gen(function* () {
          const sessions = yield* SessionStore.Service;
          const { dialog, revoked } = yield* Passkey;

          yield* confirmed("lena@example.org", "lena", "token-lena");

          const finishing = yield* Effect.forkChild(
            Account.finish("lena@example.org", true, publicComputer),
            { startImmediately: true },
          );

          const leaving = yield* Effect.forkChild(
            Account.leave("lena@example.org", publicComputer),
            { startImmediately: true },
          );

          yield* Deferred.succeed(dialog, "closed");
          yield* Fiber.await(finishing);
          yield* Fiber.join(leaving);

          return {
            revoked: yield* Ref.get(revoked),
            signedIn: Option.map(yield* sessions.current, (signed) => signed.accountId),
          };
        }).pipe(Effect.provide(withPasskeyDialog));

      assert.deepStrictEqual(
        [yield* leaveAfterClosedDialog(false), yield* leaveAfterClosedDialog(true)],
        [
          { revoked: [], signedIn: Option.some("lena") },
          { revoked: ["token-lena"], signedIn: Option.none() },
        ],
      );
    }),
  );

  // A public computer's session stays in memory however the student got in, and a kept one doesn't.
  it.effect("hands the tab's choice to the session on every way in", () =>
    Effect.gen(function* () {
      const lena = Effect.succeed(signedIn("lena", "token-lena"));

      const api = AuthApiTesting.layer({
        signIn: () => lena,
        resetPassword: () => Effect.void,
        passkeySignInOptions: Effect.succeed({ challenge: "c", options: { challenge: "c" } }),
        passkeySignIn: () => lena,
      });

      const authenticator = Layer.succeed(Passkeys.Authenticator)({
        available: Effect.succeed(true),
        create: () => Effect.die("no passkey was created"),
        get: () => Effect.succeed({ credential, prf: Option.none() }),
      });

      const ways = {
        password: (choice: boolean) => Account.signIn("lena@example.org", "geheim-genug", choice),
        reset: (choice: boolean) =>
          Account.resetPassword("lena@example.org", "145838", "ganz-neu-4567", choice),
        passkey: (choice: boolean) => Account.signInWithPasskey(choice),
        signUp: (choice: boolean) =>
          Effect.andThen(
            confirmed("lena@example.org", "lena", "token-lena"),
            Account.finish("lena@example.org", false, choice),
          ),
      };

      const kept = <E, R>(way: (choice: boolean) => Effect.Effect<unknown, E, R>) =>
        Effect.forEach([false, true], (choice) =>
          way(choice).pipe(
            Effect.andThen(SessionStore.Service.use((sessions) => sessions.current)),
            Effect.map(Option.map((signed) => signed.publicComputer)),
            Effect.provide(Layer.mergeAll(store, confirmations(), api, authenticator)),
          ),
        );

      const both = [Option.some(false), Option.some(true)];

      assert.deepStrictEqual(
        {
          password: yield* kept(ways.password),
          reset: yield* kept(ways.reset),
          passkey: yield* kept(ways.passkey),
          signUp: yield* kept(ways.signUp),
        },
        { password: both, reset: both, passkey: both, signUp: both },
      );
    }),
  );

  // A passkey a shared computer kept would sign the next person there in as the student, so a public
  // computer's new passkey goes on the student's phone or a security key.
  it.effect("puts a public computer's new passkey on another device", () =>
    Effect.gen(function* () {
      const api = AuthApiTesting.layer({
        // As Better Auth answers `authenticatorAttachment` in the query.
        passkeyCreationOptions: (_, offDevice) =>
          Effect.succeed({
            challenge: "challenge",
            options: {
              ...creation,
              authenticatorSelection: offDevice
                ? { authenticatorAttachment: "cross-platform" }
                : {},
            },
          }),
        addPasskey: () => Effect.void,
      });

      const asked = (publicComputer: boolean) =>
        Effect.gen(function* () {
          const created = yield* Ref.make(Option.none<AuthApi.CreationOptions>());

          const authenticator = Layer.succeed(Passkeys.Authenticator)({
            available: Effect.succeed(true),
            create: (options) =>
              Effect.as(Ref.set(created, Option.some(options)), {
                credential,
                prf: Passkeys.CreatedPrf.Unsupported(),
              }),
            get: () => Effect.die("no sign-in was asked for"),
          });

          yield* Effect.andThen(
            confirmed("lena@example.org", "lena", "token-lena"),
            Account.finish("lena@example.org", true, publicComputer),
          ).pipe(Effect.provide(Layer.mergeAll(store, confirmations(), api, authenticator)));

          return Option.map(yield* Ref.get(created), (options) => ({
            attachment: options.authenticatorSelection?.authenticatorAttachment,
            hints: options.hints,
          }));
        });

      assert.deepStrictEqual(
        [yield* asked(false), yield* asked(true)],
        [
          Option.some({ attachment: undefined, hints: undefined }),
          Option.some({ attachment: "cross-platform", hints: ["hybrid", "security-key"] }),
        ],
      );
    }),
  );

  // The reset code only sets the password; the device then signs in with it like any other.
  it.effect("resets a forgotten password, then signs in with the new one", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<string>>([]);
      const sessions = yield* SessionStore.Service;

      yield* Account.resetPassword(" lena@example.org", "145 838", "ganz-neu-4567", false).pipe(
        Effect.provide(
          AuthApiTesting.layer({
            resetPassword: (email, code, password) =>
              Ref.update(calls, (made) => [...made, `reset ${email} ${code} ${password}`]),
            signIn: (email, password) =>
              Effect.as(
                Ref.update(calls, (made) => [...made, `sign-in ${email} ${password}`]),
                signedIn("lena", "token-lena"),
              ),
          }),
        ),
      );

      assert.deepStrictEqual(yield* Ref.get(calls), [
        "reset lena@example.org 145838 ganz-neu-4567",
        "sign-in lena@example.org ganz-neu-4567",
      ]);
      assert.deepStrictEqual(
        Option.map(yield* sessions.current, (signed) => signed.accountId),
        Option.some("lena"),
      );
    }).pipe(Effect.provide(store)),
  );

  // A server could call any account a demo account to hand over a key it knows (ADR 0027), so
  // only the address typed here, answered with a persona's account, makes one.
  it.effect(
    "keeps a session as a demo account's only after a persona's password sign-in at a demo address",
    () =>
      Effect.gen(function* () {
        const sessions = yield* SessionStore.Service;

        const demo = Effect.map(
          sessions.current,
          Option.map((signed) => signed.demo),
        );

        yield* Account.signIn(" Lena@Demo.Studienbuch.App ", "review-passwort", false);
        const typed = yield* demo;
        yield* Account.signIn("lena@notdemo.studienbuch.app", "review-passwort", false);
        const lookalike = yield* demo;
        yield* Account.signIn("lena@demo.studienbuch.app", "review-passwort", false);
        yield* Account.signInWithPasskey(false);
        const passkey = yield* demo;
        yield* sessions.forget;
        yield* Account.signIn("lena@demo.studienbuch.app", "echtes-konto", false);
        const realAccount = yield* demo;

        assert.deepStrictEqual(
          { typed, lookalike, passkey, realAccount },
          {
            typed: Option.some(true),
            lookalike: Option.some(false),
            passkey: Option.some(false),
            realAccount: Option.some(false),
          },
        );
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            store,
            AuthApiTesting.layer({
              // A dishonest server answers one password with an ordinary account.
              signIn: (_email, password) =>
                Effect.succeed(
                  signedIn(password === "echtes-konto" ? "lena" : "demo-lena", "token-password"),
                ),
              passkeySignInOptions: Effect.succeed({
                options: { challenge: "challenge" },
                challenge: "challenge",
              }),
              passkeySignIn: () => Effect.succeed(signedIn("demo-lena", "token-passkey")),
            }),
            Layer.succeed(Passkeys.Authenticator)({
              available: Effect.succeed(true),
              create: () => Effect.die("no passkey was created"),
              get: () => Effect.succeed({ credential, prf: Option.none() }),
            }),
          ),
        ),
      ),
  );

  it.effect("says the server failed rather than that the device is offline", () =>
    Effect.gen(function* () {
      const reasonFor = (error: AuthApi.Refused | AuthApi.Unreachable | AuthApi.ServerFailed) =>
        Effect.flip(Account.signIn("lena@example.org", "lange-genug-123", false)).pipe(
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
        Option.some({
          accountId: "lena",
          token: Option.map(token, Redacted.make),
          demo: false,
          publicComputer: false,
        }),
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

  // Storage outside an account, such as "Dieses Gerät"'s, reads this. A held account's choice
  // wins over the tab's, and a device that can't hold an account still shows its diagnostics.
  it("keeps nothing as the held account chose, else as the tab chose", () => {
    const held = (publicComputer: boolean) =>
      AsyncResult.success(
        Option.some({ accountId: "lena", token: Option.none(), demo: false, publicComputer }),
      );

    assert.deepStrictEqual(
      [
        Account.keepsNothing(AsyncResult.initial(), true),
        Account.keepsNothing(AsyncResult.fail("ServerOrigin.NoServer"), true),
        Account.keepsNothing(AsyncResult.success(Option.none()), true),
        Account.keepsNothing(held(false), true),
        Account.keepsNothing(held(true), false),
      ].map(AsyncResult.value),
      [Option.none(), Option.some(true), Option.some(true), Option.some(false), Option.some(true)],
    );
  });

  // Signing out deletes the outbox and the device's key. Only a count the engine read and a notebook
  // that opens without this device let it go without asking, and one dialog names both losses.
  it("asks before signing out unless nothing waits and the notebook survives this device", () => {
    const kept = AsyncResult.success("kept" as const);
    const lost = AsyncResult.success("lost" as const);
    const failed = AsyncResult.fail("AccountDatabase.Unavailable");

    const asks = (
      [
        [AsyncResult.success(0), kept],
        [AsyncResult.success(1), kept],
        [AsyncResult.initial(), kept],
        [failed, kept],
        [AsyncResult.success(0), lost],
        [AsyncResult.success(2), lost],
        [AsyncResult.success(0), AsyncResult.success("unknown" as const)],
        [AsyncResult.success(0), AsyncResult.initial()],
        [AsyncResult.success(0), failed],
      ] as const
    ).map(([unsent, notebook]) =>
      Option.match(Account.signOutWarning(unsent, notebook), {
        onNone: () => "no",
        onSome: ({ paragraphs, offerCard }) =>
          `${String(paragraphs.length)}${offerCard ? " with card" : ""}`,
      }),
    );

    assert.deepStrictEqual(asks, [
      "no",
      "1",
      "1",
      "1",
      "1 with card",
      "2 with card",
      "1",
      "1",
      "1",
    ]);
  });
});
