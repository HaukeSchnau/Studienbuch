import { assert, it } from "@effect/vitest";
import { Access } from "@stu/api/Access";
import { Accounts } from "@stu/api/Accounts";
import { CryptoSuite } from "@stu/e2ee";
import { Ports } from "@stu/sync/client";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Ref from "effect/Ref";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { AuthApiTesting } from "../../infra/auth/AuthApiTesting.ts";
import { layer as signUpStore } from "../../infra/auth/signUpStore.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { KeyServer } from "../keys/KeyServer.ts";
import { KeyServerTesting } from "../keys/KeyServerTesting.ts";
import { NotebookKeys } from "../keys/NotebookKeys.ts";
import { Account } from "./Account.ts";

const accountId = "card-only-noa";

const engineLayer = () =>
  Layer.mergeAll(NotebookKeys.keyring, NotebookKeys.guard).pipe(
    Layer.provideMerge(AccountEngine.app(accountId)),
  );

type EngineServices = Layer.Success<ReturnType<typeof engineLayer>>;

const reservation = new Access.Reservation({
  token: "noa-reservation",
  schoolName: "Demoschule am Wiesengrund",
  kind: "student",
  expiresAt: DateTime.makeUnsafe("2999-01-01T00:00:00Z"),
});

// An account without an address in a real browser: the IndexedDB keychain, the OPFS database
// and WebCrypto, with the server's sign-in and keys in memory. Signing out must leave neither the
// unsaved card nor the notebook's key behind, and the card alone must bring both back.
it.effect("signs up without an address, signs out, and signs in by card to the same notebook", () =>
  Effect.gen(function* () {
    const registry = AtomRegistry.make();
    yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));

    const keys = yield* KeyServerTesting.make;
    const signedUp = yield* Ref.make<ReadonlyArray<string>>([]);
    const offered = yield* Ref.make(Option.none<Account.OfferedCard>());

    // As `CardLogins` answers: a login the sign-up or a card's wrapper brought signs in.
    const auth = AuthApiTesting.layer({
      cardSignUp: (login) =>
        Effect.as(
          Ref.update(signedUp, (all) => [...all, Redacted.value(login)]),
          {
            accountId,
            token: Redacted.make("noa-1"),
          },
        ),
      cardSignIn: (login) =>
        Effect.flatMap(Effect.all([Ref.get(signedUp), Ref.get(keys.logins)]), ([up, added]) =>
          [...up, ...Arr.getSomes(added)].includes(Redacted.value(login))
            ? Effect.succeed({ accountId, token: Redacted.make("noa-2") })
            : Effect.fail(new AuthApi.Refused({ status: 401, code: Accounts.unknownCard })),
        ),
      signOut: () => Effect.void,
    });

    const device = Atom.runtime(AccountEngine.device);

    const onDevice = <A, E>(
      effect: Effect.Effect<
        A,
        E,
        | Layer.Success<typeof AccountEngine.device>
        | AuthApi.Service
        | Account.Confirmations
        | CryptoSuite.Service
      >,
    ) =>
      AtomRegistry.getResult(
        registry,
        device.atom(
          effect.pipe(
            Effect.provide(
              Layer.mergeAll(auth, CryptoSuite.layer, Account.confirmations).pipe(
                Layer.provide(signUpStore),
              ),
            ),
          ),
        ),
        { suspendOnWaiting: true },
      );

    // The account's engine as the key screens run it, built afresh after each sign-in.
    const engine = () => {
      const runtime = Atom.runtime(engineLayer());

      return {
        unmount: registry.mount(runtime),
        run: <A, E>(effect: Effect.Effect<A, E, EngineServices | KeyServer.Service>) =>
          AtomRegistry.getResult(
            registry,
            runtime.atom(Effect.provideService(effect, KeyServer.Service, keys.server)),
            { suspendOnWaiting: true },
          ),
      };
    };

    // "Abmelden", as `AccountState.signOut` runs it on a device of the student's own.
    const signOut = Account.signOut((signed, forgetSession) =>
      AccountEngine.forget(
        signed.accountId,
        Option.none(),
        Layers.endSignOut(signed.accountId, forgetSession),
      ),
    );

    const rootKey = Effect.map(
      Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("root-key")),
      Option.map((bytes) => [...bytes].join(",")),
    );

    // "Konto anlegen" on a computer without passkeys, then "Deine Notfallkarte". The device holds
    // the card in the account's secrets before it keeps the session.
    yield* onDevice(Account.signUpWithCard(reservation, false, (card) => Ref.set(offered, card)));

    const first = engine();

    // The key status starts the notebook and puts the card to work. The student never presses
    // "Ich habe ihn aufgeschrieben": this device goes before that.
    const before = yield* first.run(
      Effect.gen(function* () {
        const settled = yield* NotebookKeys.settle;

        return {
          started: settled.status._tag,
          card: settled.card,
          unsaved: Option.map(yield* NotebookKeys.pendingCard, (card) => card.unsaved),
          rootKey: yield* rootKey,
        };
      }),
    );

    const text = Redacted.value(Option.getOrThrow(yield* first.run(NotebookKeys.pendingCard)).text);

    first.unmount();
    yield* onDevice(signOut);

    // Nothing of the account stays in the keychain: no card, no key.
    const left = yield* onDevice(
      Effect.provide(
        Effect.all({ card: Effect.map(NotebookKeys.pendingCard, Option.isSome), rootKey }),
        Keychain.accountSecrets(accountId),
      ),
    );

    // "Mit Notfallkarte anmelden", the code typed as it reads on paper.
    const signedIn = yield* onDevice(
      Account.signInWithCard(text.toLowerCase(), false, (card) => Ref.set(offered, card)),
    );

    const second = engine();

    const after = yield* second.run(
      Effect.gen(function* () {
        const found = yield* NotebookKeys.status;
        const settled = yield* NotebookKeys.settle;

        return {
          found: found._tag,
          opened: settled.status._tag,
          card: settled.card,
          left: Option.isSome(yield* NotebookKeys.pendingCard),
        };
      }),
    );

    const reopened = yield* second.run(rootKey);
    second.unmount();
    // The browser's storage is shared by every test here, so this one leaves nothing behind.
    yield* onDevice(signOut);

    assert.deepStrictEqual(
      {
        before: { started: before.started, card: before.card, unsaved: before.unsaved },
        left,
        after,
        signedIn,
      },
      {
        before: { started: "Unlocked", card: Option.none(), unsaved: Option.some(true) },
        left: { card: false, rootKey: Option.none() },
        after: { found: "Locked", opened: "Unlocked", card: Option.none(), left: false },
        signedIn: accountId,
      },
    );
    assert.isTrue(Option.isSome(before.rootKey), "the first device held the notebook's key");
    assert.deepStrictEqual(reopened, before.rootKey, "the card opened the same notebook");
  }).pipe(Effect.scoped),
);
