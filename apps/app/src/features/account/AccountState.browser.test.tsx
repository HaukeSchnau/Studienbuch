import { RegistryContext } from "@effect/atom-react";
import { assert, expect, it } from "@effect/vitest";
import { Access } from "@stu/api/Access";
import { Notebook, NotebookProfile } from "@stu/core";
import { RecoveryCode } from "@stu/e2ee";
import { Ports, SyncClient } from "@stu/sync/client";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { AuthApiTesting } from "../../infra/auth/AuthApiTesting.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { publicComputer } from "../../infra/device/publicComputer.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Forgetting } from "../../infra/runtime/Forgetting.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { render } from "../../infra/testing/render.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { Offered } from "../keys/Offered.ts";
import { Onboarding } from "../onboarding/Onboarding.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";
import { Account } from "./Account.ts";
import { AccountState } from "./AccountState.ts";
import { CardSignInScreen } from "./CardSignInScreen.tsx";
import { Deletion } from "./Deletion.ts";
import { DeletionServer } from "./DeletionServer.ts";

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

    // Her deletion went through, but this device couldn't erase her copy yet.
    registry.set(AccountState.deletionProblem, Option.some("forget-failed" as const));

    /** What the registry holds for `card`, without reading it, which would build it again. */
    const held = () => registry.getNodes().get(card)?.valueOption();

    const problem = () => registry.getNodes().get(AccountState.deletionProblem)?.valueOption();

    yield* session(
      (store) => store.ended(Redacted.make("first")),
      (signed) => Option.isSome(signed) && Option.isNone(token(signed)),
    );

    const afterEnd = held();

    yield* signIn("second");

    const afterSignIn = held();
    const problemBefore = problem();

    yield* session((store) => store.forget, Option.isNone);
    const afterSignOut = held();

    // Another student signs in on the device and opens "Konto löschen": the button is there.
    yield* session(
      (store) =>
        store.signedIn({ accountId: "another", token: Redacted.make("other"), demo: false }, true),
      (signed) => Option.exists(signed, (each) => each.accountId === "another"),
    );

    assert.deepStrictEqual(
      { afterEnd, afterSignIn, afterSignOut, problemBefore, problemAfter: problem() },
      {
        afterEnd: Option.some(Option.some("card")),
        afterSignIn: Option.some(Option.some("card")),
        afterSignOut: Option.some(Option.none()),
        problemBefore: Option.some(Option.some("forget-failed")),
        problemAfter: Option.some(Option.none()),
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

    yield* serverAnswers(registry, {
      signIn,
      passkeySignInOptions: Effect.andThen(Queue.offer(asked, "passkey"), Effect.never),
    });
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

    // Refused at once; a confirmation let through would ask the server, which waits.
    const answered = (result: Effect.Effect<unknown, { readonly _tag: string }>) =>
      Effect.race(
        result.pipe(
          Effect.match({
            onFailure: (error) => ("reason" in error ? error.reason : error._tag),
            onSuccess: () => "signed in",
          }),
        ),
        Effect.as(Queue.take(asked), "asked the server"),
      );

    const confirmation = yield* answered(
      AtomRegistry.getResult(registry, confirm, { suspendOnWaiting: true }),
    );

    const byPasskey = KeysState.confirmWithPasskey(accountId);
    const unmountPasskey = registry.mount(byPasskey);
    registry.set(byPasskey, undefined);

    const passkeyConfirmation = yield* answered(
      AtomRegistry.getResult(registry, byPasskey, { suspendOnWaiting: true }),
    );

    yield* Deferred.succeed(answer, undefined);
    yield* tokenNow(registry, credentials.email);
    const requests = 1 + (yield* Queue.size(asked));

    unmountConfirm();
    unmountPasskey();
    yield* signOut(registry);

    assert.deepStrictEqual(
      { confirmation, passkeyConfirmation, requests },
      { confirmation: "busy", passkeyConfirmation: "busy", requests: 1 },
    );
  }).pipe(Effect.scoped),
);

// "Abmelden" while a confirmation's sign-in hangs on the server. The sign-out wins at once. The
// answer that comes after it keeps no session, so it can't sign the student in again, and the
// session it brought ends on the server.
it.effect("sign-out wins over a sign-in that hangs, and the late answer keeps nothing", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
    const ended = yield* Ref.make<ReadonlyArray<string>>([]);
    const { asked, answer, signIn } = yield* answeredSignIn;

    yield* serverAnswers(registry, {
      signIn,
      signOut: (token) => Ref.update(ended, (all) => [...all, Redacted.value(token)]),
    });

    registry.mount(AccountState.current);
    yield* signOut(registry);
    yield* Ref.set(ended, []);

    const credentials = { email: "late-lia@example.org", password: "geheim-genug" };
    const accountId = "late-lia";
    const device = Atom.runtime(AccountEngine.device);

    const held = () =>
      AtomRegistry.getResult(
        registry,
        device.atom(
          Effect.map(
            Effect.flatMap(SessionStore.Service, (store) => store.current),
            Option.map((signed) => signed.accountId),
          ),
        ),
        { suspendOnWaiting: true },
      );

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

    const signedOut = yield* Effect.exit(
      AtomRegistry.getResult(registry, AccountState.signOut, { suspendOnWaiting: true }),
    );

    const afterSignOut = yield* held();

    yield* Deferred.succeed(answer, undefined);
    yield* Effect.exit(AtomRegistry.getResult(registry, confirm, { suspendOnWaiting: true }));

    const result = {
      signedOut: signedOut._tag,
      afterSignOut,
      confirmation: reasonOf(registry, confirm),
      afterAnswer: yield* held(),
      ended: yield* Ref.get(ended),
    };

    unmountConfirm();

    assert.deepStrictEqual(result, {
      signedOut: "Success",
      afterSignOut: Option.none<string>(),
      confirmation: Option.some<Account.Reason>("signed-out"),
      afterAnswer: Option.none<string>(),
      ended: ["old", credentials.email],
    });
  }).pipe(Effect.scoped),
);

// "Abmelden" while a card sign-in hangs on the server. The screen offers "Anmelden" again at once,
// though the old run still waits; a new sign-in there keeps its session when the old answer comes
// late, and the old run's refusal shows nowhere. The screen's atom stays alive, so it reads the
// same here as after the student went to "Abmelden" and back.
it.effect("a card sign-in that sign-out took over from leaves its screen ready for a new one", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
    const ending = yield* Queue.unbounded<string>();
    const asked = yield* Queue.unbounded<string>();
    const answer = yield* Deferred.make<void>();
    const requests = yield* Ref.make(0);
    const accountId = "late-cleo";
    const card = Redacted.value(RecoveryCode.text(Redacted.make(new Uint8Array(16).fill(7))));

    yield* serverAnswers(registry, {
      // The first request waits for `answer`, the next answers at once.
      cardSignIn: () =>
        Effect.flatMap(
          Ref.getAndUpdate(requests, (count) => count + 1),
          (count) =>
            Effect.as(
              count === 0
                ? Effect.andThen(Queue.offer(asked, "first"), Deferred.await(answer))
                : Effect.void,
              { accountId, token: Redacted.make(count === 0 ? "first" : "second") },
            ),
        ),
      signOut: (token) => Queue.offer(ending, Redacted.value(token)),
    });

    registry.mount(AccountState.current);
    yield* signOut(registry);

    // Cleo is signed in on this device, and her session ended, so "Abmelden" is there too.
    yield* AtomRegistry.getResult(
      registry,
      Atom.runtime(AccountEngine.device).atom(
        Effect.flatMap(SessionStore.Service, (store) =>
          Effect.andThen(
            store.signedIn({ accountId, token: Redacted.make("old"), demo: false }, false),
            store.ended(Redacted.make("old")),
          ),
        ),
      ),
      { suspendOnWaiting: true },
    );

    const view = yield* Effect.acquireDisposable(
      Effect.promise(() =>
        render(
          <RegistryContext.Provider value={registry}>
            <CardSignInScreen />
          </RegistryContext.Provider>,
        ),
      ),
    );

    const press = () =>
      Effect.promise(async () => {
        const button = view.getByRole("button", { name: "Anmelden", exact: true });

        await expect.element(button).toBeEnabled();
        await button.click();
      });

    yield* Effect.promise(() =>
      view.getByPlaceholder("XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX").fill(card),
    );
    yield* press();
    yield* Queue.take(asked);
    yield* signOut(registry);

    yield* press();
    yield* tokenNow(registry, "second");

    yield* Deferred.succeed(answer, undefined);
    yield* Stream.fromQueue(ending).pipe(
      Stream.filter((token) => token === "first"),
      Stream.runHead,
    );

    const held = Option.flatMap(
      AsyncResult.getOrElse(registry.get(AccountState.current), () => Option.none()),
      (signed) => Option.map(signed.token, Redacted.value),
    );

    yield* Effect.promise(() =>
      expect.element(view.getByText(Account.sentence["signed-out"])).not.toBeInTheDocument(),
    );
    yield* signOut(registry);

    assert.deepStrictEqual(held, Option.some("second"));
  }).pipe(Effect.scoped),
);

/** A device whose keychain refuses the first forgetting note, and a server that deleted everyone. */
const refusesFirstNote = AccountEngine.engines.pipe(
  Layer.provideMerge(SessionStore.layer),
  Layer.provideMerge(
    Layer.effect(Keychain.Store)(
      Effect.gen(function* () {
        const store = yield* Keychain.Store;
        const refused = yield* Ref.make(false);

        return Keychain.Store.of({
          ...store,
          set: (name, value) =>
            name.startsWith("forgetting.")
              ? Effect.flatMap(Ref.getAndSet(refused, true), (before) =>
                  before
                    ? store.set(name, value)
                    : Effect.fail(new Keychain.Unavailable({ operation: "set", cause: "locked" })),
                )
              : store.set(name, value),
        });
      }),
    ),
  ),
  Layer.provideMerge(Layers.device({ name: "refuses-first-note" })),
  Layer.provideMerge(
    Layer.succeed(DeletionServer.Service)({
      delete: () => Effect.void,
      deleted: () => Effect.succeed(true),
    }),
  ),
);

// Lena's account was deleted on her phone, and her laptop's keychain refused the forgetting note
// when the session ended. Nothing was erased yet, so the laptop tries again and erases her copy.
// Tom signed out in this tab before, and the gates now lead to the start, not to "Anmelden".
it.effect("a deleted account is erased on the next try when the keychain refused the note", () =>
  Effect.gen(function* () {
    const store = yield* SessionStore.Service;
    const engines = yield* AccountEngine.Engines;
    const registry = yield* AtomRegistry.AtomRegistry;
    const tries = yield* Queue.unbounded<Exit.Exit<void, unknown>>();
    registry.set(AccountState.signedOut, true);

    const signed = {
      accountId: "deleted-lena",
      token: Redacted.make("token-deleted"),
      demo: false,
    };

    yield* store.signedIn(signed, false);
    const engine = yield* engines.context(signed.accountId);
    yield* Context.get(engine, SyncClient.Service).setOffline(true);
    yield* Context.get(engine, SqlClient.SqlClient)`
      insert into sync_space (id, kind, role, version) values ('nb-deleted-lena', 'notebook', 'owner', 1)
    `;

    const leave = (accountId: string) =>
      AccountState.leaveDeleted(accountId).pipe(Effect.onExit((exit) => Queue.offer(tries, exit)));

    yield* Effect.forkChild(Deletion.forgetWhenDeleted(leave), { startImmediately: true });
    yield* store.ended(signed.token);
    const first = yield* Queue.take(tries);
    yield* TestClock.adjust("2 seconds");
    const second = yield* Queue.take(tries);
    const left = yield* store.current;
    const pending = yield* Forgetting.pending;

    yield* engines.keep(store.signedIn(signed, false));
    const again = yield* engines.context(signed.accountId);
    const spaces = yield* Context.get(again, SqlClient.SqlClient)`select id from sync_space`;

    assert.deepStrictEqual(
      {
        first: Exit.isFailure(first),
        second: Exit.isSuccess(second),
        left,
        pending: pending.includes(signed.accountId),
        spaces: spaces.length,
        signedOut: registry.get(AccountState.signedOut),
      },
      {
        first: true,
        second: true,
        left: Option.none(),
        pending: false,
        spaces: 0,
        signedOut: false,
      },
    );
  }).pipe(Effect.provide(Layer.merge(refusesFirstNote, AtomRegistry.layer))),
);
