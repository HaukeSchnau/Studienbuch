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
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Semaphore from "effect/Semaphore";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { AuthApiTesting } from "../../infra/auth/AuthApiTesting.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { layer as signUpStore } from "../../infra/auth/signUpStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { Names } from "../../infra/device/Names.ts";
import { DeviceSessions } from "../../infra/keychain/DeviceSessions.ts";
import { PendingSignUp } from "../../infra/auth/PendingSignUp.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { KeychainTesting } from "../../infra/keychain/KeychainTesting.ts";
import { MemoryKeychain } from "../../infra/keychain/MemoryKeychain.ts";
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";
import { Forgetting } from "../../infra/runtime/Forgetting.ts";
import { NotebookKeys } from "../keys/NotebookKeys.ts";
import { Offered } from "../keys/Offered.ts";
import { Account } from "./Account.ts";

const signedIn = (accountId: string, token: string): AuthApi.SignedIn => ({
  accountId,
  token: Redacted.make(token),
});

const server = Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") });
const phone = Device.layer({ name: "phone" });

/** A device that left no sign-out unfinished and runs none. */
const nothingUnfinished = Layer.succeed(Forgetting.Service)({ keep: (session) => session });

/** The device's sessions on `keychain`, where a sign-up also stages its card. */
const sessionsOn = (keychain: Layer.Layer<Keychain.Store>) =>
  SessionStore.layer.pipe(
    Layer.provideMerge(DeviceSessions.layer),
    Layer.provide(Layer.mergeAll(keychain, phone, server)),
  );

const storeOn = (keychain: Layer.Layer<Keychain.Store>) =>
  Layer.merge(sessionsOn(keychain), nothingUnfinished);

/** As `Engines.keep` runs them: one turn at a time, which reads the keychain first. */
const oneTurnAtATime = Layer.effect(Forgetting.Service)(
  Effect.map(Semaphore.make(1), (turns) => ({
    keep: (session) => turns.withPermit(Effect.andThen(Effect.yieldNow, session)),
  })),
);

const store = storeOn(MemoryKeychain.layer());

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

/**
 * Runs of the app on one device: each starts with empty memory and the same keychain, which
 * refuses what `refuse` names.
 */
const device = Effect.map(KeychainTesting.make, ({ keychain, refuse }) => ({
  refuse,
  run: <A, E, R>(effect: Effect.Effect<A, E, R>, api: Layer.Layer<AuthApi.Service>) =>
    effect.pipe(Effect.provide(Layer.mergeAll(storeOn(keychain), api, confirmations(keychain)))),
}));

const restarts = Effect.map(device, ({ run }) => run);

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

/** Why an effect failed, as its screen says it. */
const reason = <A, R>(effect: Effect.Effect<A, Account.Problem | NotebookKeys.Problem, R>) =>
  Effect.map(Effect.flip(effect), (problem) => problem.reason);

/** The account the device holds, and whether that account's secrets hold a card. */
const held = Effect.flatMap(
  SessionStore.Service.use((each) => each.current),
  Option.match({
    onNone: () => Effect.succeed({ account: Option.none<string>(), card: false }),
    onSome: ({ accountId }) =>
      Effect.map(
        Effect.provide(NotebookKeys.pendingCard, Keychain.accountSecrets(accountId)),
        (card) => ({ account: Option.some(accountId), card: Option.isSome(card) }),
      ),
  }),
);

/** Whether the device has a sign-up's card staged. */
const staged = Effect.map(
  DeviceSessions.Service.use((each) => each.staged),
  Option.isSome,
);

/** Signs out as the app does, deleting what the account left (`Forgetting.forget`). */
const signOut = Account.signOut((signed, forgetSession) =>
  Forgetting.forget(signed.accountId, () => Effect.void, forgetSession),
);

const noOffer: Account.Offer = { give: () => Effect.void, withdraw: () => Effect.void };

/** `Offered.card` as the app holds it. */
const offerInto = (offered: Ref.Ref<Option.Option<Account.OfferedCard>>): Account.Offer => ({
  give: (card) => Ref.set(offered, Option.some(card)),
  withdraw: (card) => Ref.update(offered, Offered.withdraw(card)),
});

const accountOf = (offered: Option.Option<Account.OfferedCard>) =>
  Option.map(offered, (card) => card.accountId);

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
        yield* sessions.ended(Redacted.make("token-lena"));

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

  // Both sign-ins asked the server while the device held no account. Only the turn that keeps a
  // session can tell, so the second one there finds the first and ends its own session.
  it.effect("keeps one of two sign-ins that both started while the device held no account", () =>
    Effect.gen(function* () {
      const asked = yield* Queue.unbounded<string>();
      const answer = yield* Deferred.make<void>();
      const ended = yield* Ref.make<ReadonlyArray<string>>([]);

      const api = AuthApiTesting.layer({
        signIn: (email) =>
          Effect.andThen(
            Effect.andThen(Queue.offer(asked, email), Deferred.await(answer)),
            Effect.sync(() => {
              const name = email.split("@")[0] ?? email;

              return signedIn(name, `token-${name}`);
            }),
          ),
        signOut: (token) => Ref.update(ended, (all) => [...all, Redacted.value(token)]),
      });

      const [lena, tom, kept] = yield* Effect.gen(function* () {
        const lena = yield* Effect.forkChild(
          Effect.result(Account.signIn("lena@example.org", "geheim-genug", false)),
          { startImmediately: true },
        );

        const tom = yield* Effect.forkChild(
          Effect.result(Account.signIn("tom@example.org", "geheim-genug", false)),
          { startImmediately: true },
        );

        yield* Queue.take(asked);
        yield* Queue.take(asked);
        yield* Deferred.succeed(answer, undefined);

        return [
          yield* Fiber.join(lena),
          yield* Fiber.join(tom),
          yield* DeviceSessions.Service.use((each) => each.all),
        ] as const;
      }).pipe(
        Effect.provide(Layer.mergeAll(sessionsOn(MemoryKeychain.layer()), oneTurnAtATime, api)),
      );

      // Whichever fiber's turn came first won; the other ended its own session only.
      const [winner, loser] = lena._tag === "Success" ? ["lena", "tom"] : ["tom", "lena"];

      assert.deepStrictEqual(
        {
          refused: [lena, tom].flatMap((each) =>
            each._tag === "Failure" ? [each.failure.reason] : [],
          ),
          kept: kept.map((each) => [each.accountId, Redacted.value(each.token)]),
          ended: yield* Ref.get(ended),
        },
        {
          refused: ["other-account"],
          kept: [[winner, `token-${winner}`]],
          ended: [`token-${loser}`],
        },
      );
    }),
  );

  // The tab's choice changed while the account was signed in on this public computer. Signing in
  // again keeps its card where its session already is: in memory, never in the keychain.
  it.effect("keeps a card where its account's session is, whatever the tab chose since", () =>
    Effect.gen(function* () {
      const offered = yield* Ref.make(Option.none<Account.OfferedCard>());
      const typed = RecoveryCode.text(Redacted.make(new Uint8Array(16).fill(4)));

      const api = AuthApiTesting.layer({
        cardSignIn: () => Effect.succeed(signedIn("mia", "mia-2")),
      });

      const kiosk = yield* device;

      const after = yield* kiosk.run(
        Effect.gen(function* () {
          const sessions = yield* SessionStore.Service;

          yield* sessions.signedIn({ ...signedIn("mia", "mia-1"), demo: false }, true);
          yield* sessions.ended(Redacted.make("mia-1"));

          yield* Account.signInWithCard(Redacted.value(typed), false, offerInto(offered));

          return {
            ...(yield* held),
            publicComputer: Option.map(yield* sessions.current, (each) => each.publicComputer),
            kept: (yield* DeviceSessions.Service.use((each) => each.all)).length,
          };
        }),
        api,
      );

      assert.deepStrictEqual(
        { ...after, offered: accountOf(yield* Ref.get(offered)) },
        {
          account: Option.some("mia"),
          card: false,
          publicComputer: Option.some(true),
          kept: 0,
          offered: Option.some("mia"),
        },
      );
    }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  // A public sign-up's card is the only copy until the key status takes it. A later sign-in that
  // isn't kept takes back only the card it offered itself.
  it.effect("takes back only its own card when its session isn't kept", () =>
    Effect.gen(function* () {
      const phone = yield* device;
      const offered = yield* Ref.make(Option.none<Account.OfferedCard>());
      const typed = RecoveryCode.text(Redacted.make(new Uint8Array(16).fill(3)));

      const api = AuthApiTesting.layer({
        cardSignUp: () => Effect.succeed(signedIn("noa", "noa-1")),
        cardSignIn: () => Effect.succeed(signedIn("mia", "mia-1")),
        signOut: () => Effect.void,
      });

      const [publicSignUp, refused, stays] = yield* phone.run(
        Effect.gen(function* () {
          yield* Account.signUpWithCard(later, true, offerInto(offered));
          const publicSignUp = accountOf(yield* Ref.get(offered));

          const refused = yield* reason(
            Account.signInWithCard(Redacted.value(typed), false, offerInto(offered)),
          );

          return [publicSignUp, refused, accountOf(yield* Ref.get(offered))] as const;
        }),
        api,
      );

      // On another device, the sign-in's own session can't be stored: its card goes again.
      const laptop = yield* device;
      const mine = yield* Ref.make(Option.none<Account.OfferedCard>());
      yield* laptop.refuse({ operation: "set", name: "sessions." });

      const unkept = yield* laptop.run(
        reason(Account.signInWithCard(Redacted.value(typed), false, offerInto(mine))),
        api,
      );

      assert.deepStrictEqual(
        { publicSignUp, refused, stays, unkept, mine: accountOf(yield* Ref.get(mine)) },
        {
          publicSignUp: Option.some("noa"),
          refused: "other-account",
          stays: Option.some("noa"),
          unkept: "failed",
          mine: Option.none(),
        },
      );
    }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  // A sign-up lost its answer on a public computer, which took its card out of the keychain. The
  // retry after the tab's choice changed sends that same card, and stages it before it goes out.
  it.effect("sends the same card again after the tab's choice changed between retries", () =>
    Effect.gen(function* () {
      const tab = yield* device;
      const sent = yield* Ref.make<ReadonlyArray<string>>([]);

      const api = AuthApiTesting.layer({
        cardSignUp: (login) =>
          Effect.andThen(
            Ref.update(sent, (all) => [...all, Redacted.value(login)]),
            Effect.fail(new AuthApi.Unreachable({ cause: "answer lost" })),
          ),
      });

      // One run of the tab: the public sign-up, then the retry after the box was cleared.
      const stagedAfter = yield* tab.run(
        Effect.gen(function* () {
          yield* Effect.flip(Account.signUpWithCard(later, true, noOffer));
          const publicTab = yield* staged;
          yield* Effect.flip(Account.signUpWithCard(later, false, noOffer));

          return [publicTab, yield* staged];
        }),
        api,
      );

      const [first, retry] = yield* Ref.get(sent);

      assert.deepStrictEqual(
        { sameCard: first !== undefined && first === retry, stagedAfter },
        { sameCard: true, stagedAfter: [false, true] },
      );
    }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  // Two sign-ins at once would each read the tab's choice and the device's account by itself.
  it.effect("refuses a second sign-in while one runs, and takes the next once it ended", () =>
    Effect.gen(function* () {
      const answer = yield* Deferred.make<void>();
      const asked = yield* Queue.unbounded<string>();

      const api = AuthApiTesting.layer({
        signIn: (email) =>
          Effect.andThen(
            Effect.andThen(Queue.offer(asked, email), Deferred.await(answer)),
            Effect.succeed(signedIn("lena", "token-lena")),
          ),
      });

      const signIn = Account.attempt(Account.signIn("lena@example.org", "geheim-genug", false));

      const result = yield* Effect.gen(function* () {
        const { attempt } = yield* SessionStore.Service;
        const first = yield* Effect.forkChild(signIn, { startImmediately: true });
        yield* Queue.take(asked);

        const during = (yield* SubscriptionRef.get(attempt)).running;
        const second = yield* reason(signIn);

        yield* Deferred.succeed(answer, undefined);
        yield* Fiber.join(first);

        const after = (yield* SubscriptionRef.get(attempt)).running;
        yield* signIn;

        return { during, second, after, asked: yield* Queue.size(asked) };
      }).pipe(Effect.provide(Layer.mergeAll(store, confirmations(), api)));

      assert.deepStrictEqual(result, { during: true, second: "busy", after: false, asked: 1 });
    }),
  );

  // A sign-out stopped after its point of no return, so its note stays. The next session waits
  // until what the account left is gone, or the device would start it on half-deleted data. The
  // session it couldn't keep ends on the server, rather than waiting there unused for 90 days.
  it.effect("keeps a new session only once the sign-out the device left unfinished finished", () =>
    Effect.gen(function* () {
      const tries = yield* Ref.make(0);
      const tokens = yield* Ref.make(0);
      const ended = yield* Ref.make<ReadonlyArray<string>>([]);

      const finish = Effect.flatMap(
        Ref.updateAndGet(tries, (count) => count + 1),
        (count) =>
          count === 1
            ? Effect.fail(new Forgetting.Unfinished({ cause: "keychain locked" }))
            : Effect.void,
      );

      const signIn = Account.signIn("lena@example.org", "geheim-genug", false);

      yield* Effect.gen(function* () {
        const sessions = yield* SessionStore.Service;

        const refused = yield* Effect.flip(signIn);

        assert.strictEqual(refused.reason, "failed");
        assert.isTrue(Option.isNone(yield* sessions.current));

        yield* signIn;

        assert.deepStrictEqual(
          Option.map(yield* sessions.current, (signed) => signed.accountId),
          Option.some("lena"),
        );
        assert.deepStrictEqual(yield* Ref.get(ended), ["token-1"]);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            store,
            AuthApiTesting.layer({
              signIn: () =>
                Effect.map(
                  Ref.updateAndGet(tokens, (count) => count + 1),
                  (count) => signedIn("lena", `token-${count}`),
                ),
              signOut: (token) => Ref.update(ended, (all) => [...all, Redacted.value(token)]),
            }),
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

        const offer: Account.Offer = {
          give: (card) => Ref.update(offered, (all) => [...all, card]),
          withdraw: () => Effect.void,
        };

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

        const [first, retry] = yield* Ref.get(sent);
        const cards = yield* Ref.get(offered);

        const keptLogin = Option.match(kept, {
          onNone: () => Effect.succeed(""),
          onSome: (card) => Effect.map(NotebookKeys.cardLogin(card.code), Redacted.value),
        });

        assert.deepStrictEqual(
          {
            lost,
            retriedWithSameLogin: first !== undefined && first === retry,
            kept: Option.map(kept, (card) => [card.endsAtSaved, card.unsaved]),
            publicKept: Option.isSome(publicKept),
            offered: cards.map((card) => card.unsaved),
            holder: Option.map(holder, (signed) => signed.accountId),
            laptop,
            signIns: (yield* Ref.get(sent)).filter((each) => each.startsWith("sign-in")).length,
          },
          {
            lost: "offline",
            retriedWithSameLogin: true,
            kept: Option.some([false, true]),
            publicKept: false,
            // The key status hears of every card: the phone's and the public computer's new ones,
            // and the one the laptop signed in with.
            offered: [true, true, false],
            holder: Option.some(`noa-${yield* keptLogin}`),
            laptop: { typo: "typo", short: "length", unknown: "unknown-card", typed: "mia" },
            // The typo and the short code never left the device.
            signIns: 2,
          },
        );
      }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  // Every keychain write a card-first sign-up depends on can fail. Each failure stops it with its
  // reason, before anything goes on with a copy in memory only: no session without its card, and
  // no card left for the next student once this one signed out.
  it.effect(
    "keeps nothing of a card sign-up the device couldn't keep, and leaves no card behind",
    () =>
      Effect.gen(function* () {
        const phone = yield* device;
        const sent = yield* Ref.make<ReadonlyArray<string>>([]);
        const ended = yield* Ref.make<ReadonlyArray<string>>([]);

        const api = AuthApiTesting.layer({
          cardSignUp: (login) =>
            Effect.map(
              Ref.updateAndGet(sent, (all) => [...all, Redacted.value(login)]),
              (all) => signedIn(`noa-${Redacted.value(login).slice(0, 8)}`, `token-${all.length}`),
            ),
          signOut: (token) => Ref.update(ended, (all) => [...all, Redacted.value(token)]),
        });

        const signUp = Account.signUpWithCard(soon, false, noOffer);
        const now = Effect.all({ held, staged });

        // The card can't be staged, or read back: nothing goes out.
        yield* phone.refuse({ operation: "set", name: "sign-up-card" });
        const unstaged = yield* phone.run(Effect.all([reason(signUp), now]), api);
        yield* phone.refuse({ operation: "get", name: "sign-up-card" });
        const unread = yield* phone.run(reason(signUp), api);
        const sentBefore = (yield* Ref.get(sent)).length;

        // The account's secrets refuse the card: the session goes, the staged card stays.
        yield* phone.refuse({ operation: "set", name: "pending-card" });
        const unheld = yield* phone.run(Effect.all([reason(signUp), now]), api);

        // After a restart it works, but the staged card can't go with the kept session.
        yield* phone.refuse({ operation: "remove", name: "sign-up-card" });
        const kept = yield* phone.run(Effect.andThen(signUp, now), api);

        yield* phone.refuse();
        const signedOut = yield* phone.run(Effect.andThen(signOut, now), api);
        const next = yield* phone.run(Effect.andThen(signUp, held), api);
        const [first, retry, other] = yield* Ref.get(sent);

        assert.deepStrictEqual(
          {
            unstaged,
            unread,
            sentBefore,
            unheld,
            kept,
            retriedWithSameLogin: first === retry,
            signedOut,
            nextIsNew: other !== undefined && other !== retry && Option.isSome(next.account),
            ended: yield* Ref.get(ended),
          },
          {
            unstaged: [
              "card-not-kept",
              { held: { account: Option.none(), card: false }, staged: false },
            ],
            unread: "card-not-kept",
            sentBefore: 0,
            unheld: [
              "card-not-kept",
              { held: { account: Option.none(), card: false }, staged: true },
            ],
            kept: {
              held: { account: Option.some(`noa-${first?.slice(0, 8)}`), card: true },
              staged: true,
            },
            retriedWithSameLogin: true,
            signedOut: { held: { account: Option.none(), card: false }, staged: false },
            nextIsNew: true,
            // The unkept session, then the one that signed out.
            ended: ["token-1", "token-2"],
          },
        );
      }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  // A public computer keeps its card in the tab's memory. It takes up a card an earlier sign-up in
  // this browser staged, so the retry reaches the account a lost answer made, and removes it before
  // anything goes out: nothing of either stays once the tab is gone.
  it.effect(
    "keeps a public computer's card in the tab, so the next sign-up gets a new account",
    () =>
      Effect.gen(function* () {
        const kiosk = yield* device;
        const sent = yield* Ref.make<ReadonlyArray<string>>([]);
        const answerLost = yield* Ref.make(true);

        const api = AuthApiTesting.layer({
          cardSignUp: (login) =>
            Effect.andThen(
              Ref.update(sent, (all) => [...all, Redacted.value(login)]),
              Effect.flatMap(Ref.getAndSet(answerLost, false), (lost) =>
                lost
                  ? Effect.fail(new AuthApi.Unreachable({ cause: "answer lost" }))
                  : Effect.succeed(signedIn(`noa-${Redacted.value(login).slice(0, 8)}`, "noa-1")),
              ),
            ),
        });

        const signUp = (publicComputer: boolean) =>
          Account.signUpWithCard(later, publicComputer, noOffer);

        // A sign-up in a tab that keeps its account lost its answer, and the tab closed.
        const lost = yield* kiosk.run(Effect.andThen(reason(signUp(false)), staged), api);

        // A public tab that can't remove that card sends nothing.
        yield* kiosk.refuse({ operation: "remove", name: "sign-up-card" });
        const refused = yield* kiosk.run(Effect.all([reason(signUp(true)), staged]), api);
        const sentBefore = (yield* Ref.get(sent)).length;
        yield* kiosk.refuse();

        const publicTab = yield* kiosk.run(Effect.andThen(signUp(true), staged), api);

        // That tab closed too, which forgets its session and its card.
        yield* kiosk.run(signUp(false), api);
        const [first, retry, next] = yield* Ref.get(sent);

        assert.deepStrictEqual(
          {
            lost,
            refused,
            sentBefore,
            publicTab,
            retriedTheSameAccount: first === retry,
            nextHasItsOwn: next !== undefined && next !== first,
          },
          {
            lost: true,
            refused: ["card-not-kept", true],
            sentBefore: 1,
            publicTab: false,
            retriedTheSameAccount: true,
            nextHasItsOwn: true,
          },
        );
      }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  // A card typed on a device that can't keep it would leave a session whose first key starts
  // without the card's wrapper after a restart.
  it.effect("signs nobody in with a typed card the device couldn't keep", () =>
    Effect.gen(function* () {
      const laptop = yield* device;
      const ended = yield* Ref.make<ReadonlyArray<string>>([]);
      const offered = yield* Ref.make(0);
      const typed = RecoveryCode.text(Redacted.make(new Uint8Array(16).fill(5)));

      const api = AuthApiTesting.layer({
        cardSignIn: () => Effect.succeed(signedIn("mia", "mia-1")),
        signOut: (token) => Ref.update(ended, (all) => [...all, Redacted.value(token)]),
      });

      yield* laptop.refuse({ operation: "set", name: "pending-card" });

      const refused = yield* laptop.run(
        reason(
          Account.signInWithCard(Redacted.value(typed), false, {
            give: () => Ref.update(offered, (count) => count + 1),
            withdraw: () => Effect.void,
          }),
        ),
        api,
      );

      yield* laptop.refuse();

      assert.deepStrictEqual(
        {
          refused,
          offered: yield* Ref.get(offered),
          ended: yield* Ref.get(ended),
          afterRestart: yield* laptop.run(held, api),
        },
        {
          refused: "card-not-kept",
          offered: 0,
          ended: ["mia-1"],
          afterRestart: { account: Option.none(), card: false },
        },
      );
    }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  // Signing back in to an account whose sign-out the device left unfinished: that sign-out
  // finishes before the session and deletes the account's secrets, so the card comes after it.
  it.effect("keeps a typed card past the unfinished sign-out of the same account", () =>
    Effect.gen(function* () {
      const laptop = yield* device;
      const typed = RecoveryCode.text(Redacted.make(new Uint8Array(16).fill(6)));

      const api = AuthApiTesting.layer({
        cardSignIn: () => Effect.succeed(signedIn("mia", "mia-1")),
      });

      // As `Forgetting.Service` runs it: the account's earlier sign-out, then the new session.
      const unfinished = Layer.effect(Forgetting.Service)(
        Effect.map(Effect.context<Keychain.Store>(), (context) => ({
          keep: (session) =>
            Effect.andThen(
              Keychain.forgetSecrets(
                Names.secrets(new URL("https://one.example"), "phone", "mia"),
              ).pipe(Effect.provide(context)),
              session,
            ),
        })),
      );

      const kept = yield* laptop.run(
        Effect.andThen(Account.signInWithCard(Redacted.value(typed), false, noOffer), held).pipe(
          Effect.provide(unfinished),
        ),
        api,
      );

      assert.deepStrictEqual(kept, { account: Option.some("mia"), card: true });
    }).pipe(Effect.provide(TestCrypto.layer("Account.test card"))),
  );

  // The passkey made the account already, so a retry that prompted again would make a second one.
  it.effect("keeps a passkey sign-up's account for the retry when its card couldn't be kept", () =>
    Effect.gen(function* () {
      const phone = yield* device;
      const made = yield* Ref.make(0);

      const api = AuthApiTesting.layer({
        passkeySignUpOptions: () => Effect.succeed({ challenge: "challenge", options: creation }),
        passkeySignUp: () =>
          Effect.as(
            Ref.update(made, (count) => count + 1),
            signedIn("pia", "pia-1"),
          ),
      });

      const signUp = Account.signUpWithPasskey(soon, noOffer).pipe(
        Effect.provideService(Passkeys.Authenticator, {
          available: Effect.succeed(true),
          create: () => Effect.succeed({ credential, prf: Passkeys.CreatedPrf.Unsupported() }),
          get: () => Effect.die("no sign-in was asked for"),
        }),
      );

      const [refused, unkept, retried] = yield* phone.run(
        Effect.gen(function* () {
          yield* phone.refuse({ operation: "set", name: "pending-card" });

          const refused = yield* Effect.map(Effect.flip(signUp), (error) =>
            error._tag === "Account.Problem" ? error.reason : error._tag,
          );

          const unkept = yield* held;

          yield* phone.refuse();
          yield* signUp;

          return [refused, unkept, yield* held] as const;
        }),
        api,
      );

      assert.deepStrictEqual(
        { refused, unkept, retried, made: yield* Ref.get(made) },
        {
          refused: "card-not-kept",
          unkept: { account: Option.none(), card: false },
          retried: { account: Option.some("pia"), card: true },
          made: 1,
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

  // A server that takes its time to end the session must not hold the next sign-in once the device
  // forgot the account. The session it ends is the one the device erased: a sign-in kept after the
  // sign-out read the account, as a late confirmation can be, replaced the token read then.
  it.effect("signs in again while the server ends the session sign-out erased", () =>
    Effect.gen(function* () {
      const ending = yield* Queue.unbounded<string>();

      yield* Effect.gen(function* () {
        const sessions = yield* SessionStore.Service;

        yield* sessions.signedIn({ ...signedIn("lena", "token-read"), demo: false }, false);
        yield* Effect.forkChild(
          Account.signOut((_, forgetSession) =>
            Effect.andThen(
              sessions.signedIn({ ...signedIn("lena", "token-kept"), demo: false }, false),
              forgetSession,
            ),
          ),
        );

        const ended = yield* Queue.take(ending);
        const next = yield* Effect.exit(Account.attempt(Effect.void));

        assert.deepStrictEqual(
          { ended, next: next._tag },
          { ended: "token-kept", next: "Success" },
        );
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            store,
            confirmations(),
            AuthApiTesting.layer({
              signOut: (token) =>
                Effect.andThen(Queue.offer(ending, Redacted.value(token)), Effect.never),
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

  // Storage outside an account, such as "Diagnose"'s, reads this. A held account's choice
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
