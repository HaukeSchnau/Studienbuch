import { assert, it } from "@effect/vitest";
import { Notebook, NotebookProfile } from "@stu/core";
import { SyncClient } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import type { Keychain } from "../../infra/keychain/Keychain.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Onboarding } from "../onboarding/Onboarding.ts";
import { OnboardingState } from "../onboarding/OnboardingState.ts";
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
      (store) => store.ended,
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
