import { assert, it } from "@effect/vitest";
import { Notebook, NotebookProfile } from "@stu/core";
import { SyncClient } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { Onboarding } from "../onboarding/Onboarding.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";
import { AccountState } from "./AccountState.ts";
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
      (store) => store.ended,
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
it.effect("a deleted account is erased on the next try when the keychain refused the note", () =>
  Effect.gen(function* () {
    const store = yield* SessionStore.Service;
    const engines = yield* AccountEngine.Engines;
    const tries = yield* Queue.unbounded<Exit.Exit<void, unknown>>();

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
      AccountState.leaveDeleted(accountId, Effect.void).pipe(
        Effect.onExit((exit) => Queue.offer(tries, exit)),
      );

    yield* Effect.forkChild(Deletion.forgetWhenDeleted(leave), { startImmediately: true });
    yield* store.ended;
    const first = yield* Queue.take(tries);
    yield* TestClock.adjust("2 seconds");
    const second = yield* Queue.take(tries);
    const left = yield* store.current;

    yield* engines.keep(store.signedIn(signed, false));
    const again = yield* engines.context(signed.accountId);
    const spaces = yield* Context.get(again, SqlClient.SqlClient)`select id from sync_space`;

    assert.deepStrictEqual(
      { first: Exit.isFailure(first), second: Exit.isSuccess(second), left, spaces: spaces.length },
      { first: true, second: true, left: Option.none(), spaces: 0 },
    );
  }).pipe(Effect.provide(refusesFirstNote)),
);
