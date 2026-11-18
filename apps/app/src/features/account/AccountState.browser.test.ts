import { assert, it } from "@effect/vitest";
import { Access } from "@stu/api/Access";
import { Notebook, NotebookProfile } from "@stu/core";
import { Ports, SyncClient } from "@stu/sync/client";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { AuthApiTesting } from "../../infra/auth/AuthApiTesting.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { publicComputer } from "../../infra/device/publicComputer.ts";
import type { Keychain } from "../../infra/keychain/Keychain.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { KeysState } from "../keys/KeysState.ts";
import { Offered } from "../keys/Offered.ts";
import { Onboarding } from "../onboarding/Onboarding.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";
import { Account } from "./Account.ts";
import { AccountState } from "./AccountState.ts";

const accountId = "leaves-lena";

const notebook = Notebook.Id.make("nb-leaves-lena");

const lena = Schema.decodeSync(NotebookProfile.DisplayName)("Lena");

/** A notebook at a school without terms, as a pull leaves it, so the name is all the first start asks. */
const seed = Effect.gen(function* () {
  yield* Effect.flatMap(SyncClient.Service, (sync) => sync.setOffline(true));
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    insert into sync_space (id, kind, role, version) values
      (${notebook}, 'notebook', 'owner', 1), ('demo', 'school', 'reader', 1)
  `;

  yield* sql`
    insert into base_row (space, tbl, id, version, data) values
      (${notebook}, 'Notebook', ${notebook}, 1, '{"schoolId":"demo"}'),
      ('demo', 'School', 'demo', 1, '{"name":"Demo-Gymnasium","timeZone":"Europe/Berlin"}')
  `;
});

// On a shared phone, the next person to sign in must not meet the last student's name: sign-out
// leaves nothing of the account in the app's memory, also when the same account comes back.
it.effect("signing out leaves the student's name nowhere, so signing in again starts afresh", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));

    const device = Atom.runtime(AccountEngine.device);

    const signIn = () =>
      AtomRegistry.getResult(
        registry,
        device.atom(
          Effect.flatMap(SessionStore.Service, (store) =>
            store.signedIn(
              { accountId, token: Redacted.make(`token-${accountId}`), demo: false },
              false,
            ),
          ),
        ),
        { suspendOnWaiting: true },
      );

    yield* signIn();

    const engine = Atom.runtime(AccountEngine.app(accountId));
    const unmountEngine = registry.mount(engine);

    yield* AtomRegistry.getResult(registry, engine.atom(seed), { suspendOnWaiting: true });

    // The gate reads the first start, and its screen finishes it with the name.
    const reading = OnboardingState.reading(accountId);
    const unmountGate = registry.mount(reading);
    const finish = OnboardingState.finish(accountId);
    const unmountScreen = registry.mount(finish);

    registry.set(finish, {
      notebook,
      displayName: lena,
      adult: false,
      choice: Option.none(),
      refused: Option.none(),
    });

    yield* AtomRegistry.getResult(registry, finish, { suspendOnWaiting: true });

    const greeting = () => Onboarding.greeting(registry.get(OnboardingState.reading(accountId)));

    assert.deepStrictEqual(greeting(), Option.some(Option.some(lena)), "before signing out");

    // "Abmelden" on "Dieses Gerät": the screens go with the session.
    unmountScreen();
    unmountGate();
    unmountEngine();

    registry.set(AccountState.signOut, Option.none());
    yield* AtomRegistry.getResult(registry, AccountState.signOut, { suspendOnWaiting: true });

    yield* signIn();

    const unmountAgain = registry.mount(OnboardingState.reading(accountId));
    yield* AtomRegistry.getResult(registry, OnboardingState.reading(accountId));

    // The device forgot the notebook and its key, so nothing it reads now holds the name.
    assert.deepStrictEqual(greeting(), Option.some(Option.none()), "after signing in again");

    unmountAgain();
  }).pipe(Effect.scoped),
);

// The unsent Notfallkarte and the key warning outlive their screens, not the account: a new
// token or the session's end keeps them, sign-out drops them even when no screen reads them.
it.effect("an account's memory lasts through a new token and the session's end, not sign-out", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
    registry.mount(AccountState.current);

    const device = Atom.runtime(AccountEngine.device);

    /** Changes the session as `change` does, and waits until `AccountState.current` shows it. */
    const session = (
      change: (store: SessionStore.Service["Service"]) => Effect.Effect<void, Keychain.Unavailable>,
      shows: (signed: Option.Option<SessionStore.Signed>) => boolean,
    ) =>
      Effect.andThen(
        AtomRegistry.getResult(
          registry,
          device.atom(Effect.flatMap(SessionStore.Service, change)),
          { suspendOnWaiting: true },
        ),
        AtomRegistry.toStreamResult(registry, AccountState.current).pipe(
          Stream.filter(shows),
          Stream.runHead,
        ),
      );

    const token = (signed: Option.Option<SessionStore.Signed>) =>
      Option.map(
        Option.flatMap(signed, (each) => each.token),
        Redacted.value,
      );

    const signIn = (value: string) =>
      session(
        (store) =>
          store.signedIn(
            { accountId: "remembers", token: Redacted.make(value), demo: false },
            true,
          ),
        (signed) => Option.contains(token(signed), value),
      );

    yield* signIn("first");

    const card = AccountState.memory(Option.none<string>());
    registry.set(card, Option.some("card"));

    /** What the registry holds for `card`, without reading it, which would build it again. */
    const held = () => registry.getNodes().get(card)?.valueOption();

    yield* session(
      (store) => store.ended(Redacted.make("first")),
      (signed) => Option.isSome(signed) && Option.isNone(token(signed)),
    );

    const afterEnd = held();

    yield* signIn("second");

    const afterSignIn = held();

    yield* session((store) => store.forget, Option.isNone);

    assert.deepStrictEqual(
      { afterEnd, afterSignIn, afterSignOut: held() },
      {
        afterEnd: Option.some(Option.some("card")),
        afterSignIn: Option.some(Option.some("card")),
        afterSignOut: Option.some(Option.none()),
      },
    );
  }).pipe(Effect.scoped),
);

/**
 * Puts `calls` in place of the server for every runtime `registry` builds: `AuthApi.layer`, which
 * `AccountEngine.device` holds, is built from them in the registry's layer memo map first.
 */
const serverAnswers = (
  registry: AtomRegistry.AtomRegistry,
  calls: Partial<AuthApi.Service["Service"]>,
) =>
  Effect.gen(function* () {
    registry.mount(Atom.runtime.memoMap);
    const scope = yield* Effect.scope;

    // The memo map keys a layer by identity. The fake needs none of the real one's services, which
    // the priming effect only names.
    yield* registry
      .get(Atom.runtime.memoMap)
      .getOrElseMemoize(AuthApi.layer, scope, () =>
        Layer.buildWithScope(AuthApiTesting.layer({ signOut: () => Effect.void, ...calls }), scope),
      )
      .pipe(
        Effect.provide(
          Layer.mergeAll(
            FetchHttpClient.layer,
            Layer.succeed(Ports.Server)({ origin: new URL(window.location.origin) }),
          ),
        ),
      );
  });

/** A password sign-in the test answers: each call waits in `asked` until `answer` is done. */
const answeredSignIn = Effect.gen(function* () {
  const asked = yield* Queue.unbounded<string>();
  const answer = yield* Deferred.make<void>();

  const signIn = (email: string) =>
    Effect.andThen(
      Effect.andThen(Queue.offer(asked, email), Deferred.await(answer)),
      Effect.succeed({ accountId: email.split("@")[0] ?? email, token: Redacted.make(email) }),
    );

  return { asked, answer, signIn };
});

const tokenNow = (registry: AtomRegistry.AtomRegistry, value: string) =>
  AtomRegistry.toStreamResult(registry, AccountState.current).pipe(
    Stream.filter((signed) =>
      Option.exists(
        Option.flatMap(signed, (each) => each.token),
        (token) => Redacted.value(token) === value,
      ),
    ),
    Stream.runHead,
  );

const isProblem = Schema.is(Account.Problem);

/** Why an atom's last run failed, as the screens say it. */
const reasonOf = (
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>,
) => {
  const result = registry.get(atom);

  return AsyncResult.isFailure(result)
    ? Option.flatMap(Cause.findErrorOption(result.cause), (error) =>
        isProblem(error) ? Option.some(error.reason) : Option.none(),
      )
    : Option.none();
};

/** Signs out whatever the device holds, as a test before may leave its account in this browser. */
const signOut = (registry: AtomRegistry.AtomRegistry) =>
  Effect.gen(function* () {
    registry.set(AccountState.signOut, Option.none());
    yield* AtomRegistry.getResult(registry, AccountState.signOut, { suspendOnWaiting: true });
  });

// A second press while a sign-in runs: by default an atom's new call interrupts its running one,
// which let a second request go out. The first runs on, and the second meets the device's attempt.
it.effect("a second call of a running sign-in is refused, and the first runs to its end", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
    const { asked, answer, signIn } = yield* answeredSignIn;
    yield* serverAnswers(registry, { signIn });
    registry.mount(AccountState.current);
    yield* signOut(registry);
    registry.mount(AccountState.signIn);

    const credentials = { email: "twice-tom@example.org", password: "geheim-genug" };
    registry.set(AccountState.signIn, credentials);
    yield* Queue.take(asked);
    registry.set(AccountState.signIn, credentials);

    yield* Deferred.succeed(answer, undefined);
    yield* tokenNow(registry, credentials.email);

    const result = {
      second: reasonOf(registry, AccountState.signIn),
      requests: 1 + (yield* Queue.size(asked)),
    };

    yield* signOut(registry);

    assert.deepStrictEqual(result, { second: Option.some("busy"), requests: 1 });
  }).pipe(Effect.scoped),
);

// A public computer's new card exists only in what the sign-up hands to the key status. A second
// press must not lose it: the first run outlives its atom's context and hands it over anyway.
it.effect("a public sign-up hands its card over though its button was pressed again", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
    const asked = yield* Queue.unbounded<string>();
    const answer = yield* Deferred.make<void>();

    yield* serverAnswers(registry, {
      cardSignUp: () =>
        Effect.andThen(
          Effect.andThen(Queue.offer(asked, "card"), Deferred.await(answer)),
          Effect.succeed({ accountId: "twice-noa", token: Redacted.make("twice-noa") }),
        ),
    });

    registry.mount(AccountState.current);
    yield* signOut(registry);
    registry.set(publicComputer, true);

    const reservation = new Access.Reservation({
      token: "twice-noa-reservation",
      schoolName: "Demoschule am Wiesengrund",
      kind: "student",
      expiresAt: DateTime.makeUnsafe("2999-01-01T00:00:00Z"),
    });

    registry.set(AccountState.signUpWithCard, reservation);
    yield* Queue.take(asked);
    registry.set(AccountState.signUpWithCard, reservation);

    yield* Deferred.succeed(answer, undefined);
    yield* tokenNow(registry, "twice-noa");

    const offered = Option.map(registry.get(Offered.card), (card) => card.accountId);
    const second = reasonOf(registry, AccountState.signUpWithCard);

    yield* signOut(registry);
    registry.set(publicComputer, false);

    assert.deepStrictEqual(
      { offered, second },
      { offered: Option.some("twice-noa"), second: Option.some("busy") },
    );
  }).pipe(Effect.scoped),
);

// "Kurz bestätigen" runs in the account's own runtime. While a sign-in from the screens runs, it
// is refused there too, so that sign-in's session can't overwrite the confirmation's token.
it.effect("an account's confirmation is refused while a sign-in from the screens runs", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
    const { asked, answer, signIn } = yield* answeredSignIn;
    yield* serverAnswers(registry, { signIn });
    registry.mount(AccountState.current);
    yield* signOut(registry);

    const credentials = { email: "busy-ben@example.org", password: "geheim-genug" };
    const accountId = "busy-ben";
    const device = Atom.runtime(AccountEngine.device);

    // Ben is signed in on this device, and his session ended.
    yield* AtomRegistry.getResult(
      registry,
      device.atom(
        Effect.flatMap(SessionStore.Service, (store) =>
          Effect.andThen(
            store.signedIn({ accountId, token: Redacted.make("old"), demo: false }, false),
            store.ended(Redacted.make("old")),
          ),
        ),
      ),
      { suspendOnWaiting: true },
    );

    registry.mount(AccountState.signIn);
    registry.set(AccountState.signIn, credentials);
    yield* Queue.take(asked);

    const confirm = KeysState.withPassword(accountId);
    const unmountConfirm = registry.mount(confirm);
    registry.set(confirm, credentials);

    // Refused at once; a confirmation let through would ask the server, which waits for `answer`.
    const confirmation = yield* Effect.race(
      AtomRegistry.getResult(registry, confirm, { suspendOnWaiting: true }).pipe(
        Effect.match({
          onFailure: (error) => ("reason" in error ? error.reason : error._tag),
          onSuccess: () => "signed in",
        }),
      ),
      Effect.as(Queue.take(asked), "asked the server"),
    );

    yield* Deferred.succeed(answer, undefined);
    yield* tokenNow(registry, credentials.email);
    const requests = 1 + (yield* Queue.size(asked));

    unmountConfirm();
    yield* signOut(registry);

    assert.deepStrictEqual({ confirmation, requests }, { confirmation: "busy", requests: 1 });
  }).pipe(Effect.scoped),
);

// "Abmelden" while a confirmation's sign-in waits for the server. Let through, the sign-out would
// finish first, and the late answer would then sign the student in again on a device they left.
it.effect(
  "sign-out is refused while a sign-in runs, so its answer can't sign anyone in after",
  () =>
    Effect.gen(function* () {
      const registry = AtomRegistry.make();
      yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
      const { asked, answer, signIn } = yield* answeredSignIn;
      yield* serverAnswers(registry, { signIn });
      registry.mount(AccountState.current);
      yield* signOut(registry);

      const credentials = { email: "late-lia@example.org", password: "geheim-genug" };
      const accountId = "late-lia";
      const device = Atom.runtime(AccountEngine.device);

      yield* AtomRegistry.getResult(
        registry,
        device.atom(
          Effect.flatMap(SessionStore.Service, (store) =>
            store.signedIn({ accountId, token: Redacted.make("old"), demo: false }, false),
          ),
        ),
        { suspendOnWaiting: true },
      );

      const confirm = KeysState.withPassword(accountId);
      const unmountConfirm = registry.mount(confirm);
      registry.set(confirm, credentials);
      yield* Queue.take(asked);

      registry.set(AccountState.signOut, Option.none());
      yield* Effect.exit(
        AtomRegistry.getResult(registry, AccountState.signOut, { suspendOnWaiting: true }),
      );
      const refused = reasonOf(registry, AccountState.signOut);

      yield* Deferred.succeed(answer, undefined);
      yield* tokenNow(registry, credentials.email);

      unmountConfirm();
      yield* signOut(registry);

      assert.deepStrictEqual(refused, Option.some("busy"));
    }).pipe(Effect.scoped),
);
