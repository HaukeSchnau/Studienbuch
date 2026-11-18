import { useAtomValue } from "@effect/atom-react";
import { Demo } from "@stu/api/Demo";
import { Keys } from "@stu/api/Keys";
import { Ports, SyncClient } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Stream from "effect/Stream";

import { ApiProtocol } from "../../infra/api/ApiProtocol.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";
import { layer as authenticator } from "../../infra/passkeys/platform.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Account } from "../account/Account.ts";
import { AccountState } from "../account/AccountState.ts";
import { KeyServer } from "./KeyServer.ts";
import { NotebookKeys } from "./NotebookKeys.ts";
import { Offered } from "./Offered.ts";

// The notebook's key on this device as atoms for the screens, on the account's engine.

export * as KeysState from "./KeysState.ts";

const unreachable = { RpcClientError: () => Effect.fail(new KeyServer.Unreachable()) };

/** `KeyServer` over HTTP, with the token of the engine's session at each call. */
const keyServer = Layer.effect(KeyServer.Service)(
  Effect.gen(function* () {
    const client = yield* RpcClient.make(Keys.Rpcs.merge(Demo.Rpcs));

    return KeyServer.Service.of({
      state: client["Keys.state"]().pipe(Effect.catchTags({ ...unreachable })),
      init: (record, wrapper) =>
        client["Keys.init"]({ record, wrapper }).pipe(Effect.catchTags({ ...unreachable })),
      addWrapper: (wrapper, login) =>
        client["Keys.addWrapper"]({
          wrapper,
          login: Option.getOrUndefined(Option.map(login, Redacted.value)),
        }).pipe(Effect.catchTags({ ...unreachable })),
      fetchSeals: (method) =>
        client["Keys.fetchSeals"]({ method }).pipe(Effect.catchTags({ ...unreachable })),
      demoRootKey: client["Demo.rootKey"]().pipe(
        Effect.map(({ rootKey }) => Option.some(Redacted.make(rootKey))),
        Effect.catchTags({
          ...unreachable,
          "Demo.NotDemo": () => Effect.succeedNone,
          "Demo.SignedOut": () => Effect.fail(new Keys.SignedOut()),
        }),
      ),
    });
  }),
).pipe(
  Layer.provide(
    Layer.unwrap(Effect.map(Ports.Session, (session) => ApiProtocol.authenticated(session.token))),
  ),
);

const runtime = Atom.family((accountId: string) =>
  Atom.runtime(
    Layer.mergeAll(keyServer, NotebookKeys.keyring, authenticator).pipe(
      Layer.provideMerge(AccountEngine.app(accountId)),
    ),
  ),
);

/** The account signed in on this device, while one is. */
export const useAccountId = (): Option.Option<string> =>
  Option.map(
    Option.flatten(AsyncResult.value(useAtomValue(AccountState.current))),
    (signed) => signed.accountId,
  );

/**
 * The device holds a root key that the account's key chain on the server doesn't derive, so what it
 * seals now would be refused. Only support can sort that out in M1.
 */
export const mismatch = AccountState.memory(false);

/**
 * Why the passkey or the card of the last sign-in couldn't open the notebook, for "Notizbuch
 * entsperren".
 */
export const signInProblem = AccountState.memory(Option.none<NotebookKeys.Reason>());

const ofAccount =
  (accountId: string) =>
  <A extends { readonly accountId: string }>(offered: Option.Option<A>) =>
    Option.filter(offered, (each) => each.accountId === accountId);

/**
 * Where this device stands with the notebook's key. Reading it starts a new account's key. A PRF
 * output that a passkey sign-in or registration left then unlocks a locked device, or adds the
 * passkey's wrapper on an unlocked one; the card a sign-in left does the same for the card.
 */
export const status = Atom.family((accountId: string) =>
  runtime(accountId).atom((get) =>
    Effect.gen(function* () {
      const before = yield* NotebookKeys.status;
      const mine = ofAccount(accountId);
      const passkey = mine(get(Offered.prf));
      const card = mine(get(Offered.typedCard));

      // A device that can't reach the server, or a public computer, has nothing to open yet.
      const usable = before._tag === "Locked" || before._tag === "Unlocked";

      const use = Option.isSome(passkey)
        ? Option.some(NotebookKeys.usePasskey(passkey.value.credentialId, passkey.value.prf))
        : Option.isSome(card) && usable
          ? Option.some(NotebookKeys.useCard(card.value.code))
          : Option.none();

      if (Option.isSome(use)) {
        const used = yield* Effect.result(use.value);

        get.set(
          signInProblem,
          before._tag === "Locked" &&
            used._tag === "Failure" &&
            used.failure._tag === "NotebookKeys.Problem"
            ? Option.some(used.failure.reason)
            : Option.none(),
        );
      }

      // Cleared last: clearing it reads this atom again, which would interrupt the unlock.
      if (Option.isSome(passkey)) get.set(Offered.prf, Option.none());
      else if (Option.isSome(card)) get.set(Offered.typedCard, Option.none());

      const now = Option.isSome(use) ? yield* NotebookKeys.status : before;

      // The device's own wrapper and generation 0 reach the server after the screen moved on,
      // in the engine's scope, so sign-out stops it.
      if (now._tag === "Unlocked") {
        const flag = (matches: boolean) => Effect.sync(() => get.set(mismatch, !matches));

        yield* Effect.forkIn(
          Effect.ignore(Effect.flatMap(NotebookKeys.reconcile, flag)),
          yield* AccountEngine.EngineScope,
        );
      }

      return now;
    }),
  ),
);

/**
 * Why the engine holds this account's encrypted changes back: the server has no key record for
 * it (`no-key-record`), or the account's key is newer than this device's (`keys-behind`).
 */
export const held = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Stream.unwrap(Effect.map(SyncClient.Service, (sync) => sync.status.changes)).pipe(
      Stream.map((status) => status.held),
      Stream.changes,
    ),
  ),
);

/**
 * While the server has no key record for the account, as after a restore, publishes this device's
 * own again. The engine then sends what it held on its next round.
 */
export const republish = Atom.family((accountId: string) =>
  runtime(accountId).atom((get) =>
    Option.contains(Option.flatten(AsyncResult.value(get(held(accountId)))), "no-key-record")
      ? NotebookKeys.reconcile
      : Effect.void,
  ),
);

/** Why the engine holds this account's encrypted changes back, while it does. */
export const useHeld = (accountId: string) =>
  Option.flatten(AsyncResult.value(useAtomValue(held(accountId))));

/**
 * A Notfallkarte whose wrapper didn't reach the server for sure, in memory only. "Notfallkarte
 * erstellen" sends this one again, so the code shown is always the one the server holds.
 */
const unsentCard = AccountState.memory(Option.none<NotebookKeys.Card>());

/** "Notizbuch-Schlüssel": the methods the server holds, and whether one survives this device. */
export const summary = Atom.family((accountId: string) =>
  // After the status, which starts a new account's key when this screen is the first to ask.
  runtime(accountId).atom((get) =>
    Effect.andThen(get.result(status(accountId)), NotebookKeys.summary),
  ),
);

/**
 * `NotebookKeys.atSignOut` as "Abmelden" is pressed, so a way in that another device added or the
 * server lost since counts. It gives up after a few seconds: a check that fails or hangs makes
 * the question ask (`Account.signOutWarning`).
 */
export const checkSignOut = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.andThen(get.result(status(accountId)), NotebookKeys.atSignOut).pipe(
      Effect.timeout("3 seconds"),
    ),
  ),
);

// The summary reads the status, so refreshing the status alone runs both again, in order.
const refresh = (accountId: string, get: Atom.FnContext) =>
  Effect.sync(() => get.refresh(status(accountId)));

/** "Mit der Notfallkarte": the typed code. */
export const unlockWithCode = Atom.family((accountId: string) =>
  runtime(accountId).fn<string>()((typed, get) =>
    Effect.andThen(NotebookKeys.unlockWithCode(typed), refresh(accountId, get)),
  ),
);

/**
 * A passkey prompt, which also signs in again, and its PRF output: "Mit Passkey" on a locked
 * device, and the confirmation that makes the sign-in fresh before a new Notfallkarte.
 */
export const withPasskey = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.gen(function* () {
      const used = yield* Account.signInWithPasskey(yield* Device.PublicComputer);

      yield* NotebookKeys.usePasskey(used.credentialId, used.prf);
      yield* refresh(accountId, get);
    }),
  ),
);

/** The password confirmation that makes the sign-in fresh, where the account has no passkey. */
export const withPassword = Atom.family((accountId: string) =>
  runtime(accountId).fn<{ readonly email: string; readonly password: string }>()(
    ({ email, password }) =>
      Effect.flatMap(Device.PublicComputer, (publicComputer) =>
        Account.signIn(email, password, publicComputer),
      ),
  ),
);

/**
 * "Notfallkarte erstellen": the new code's text, which the screen shows once and keeps nowhere.
 * Fails with "not-fresh" when the sign-in is older than `Keys.freshSignInMinutes`.
 */
export const createRecoveryCode = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.gen(function* () {
      const waiting = get(unsentCard);
      const card = Option.isSome(waiting) ? waiting.value : yield* NotebookKeys.newRecoveryCode;

      get.set(unsentCard, Option.some(card));

      const text = yield* NotebookKeys.sendRecoveryCode(card).pipe(
        Effect.tapError((refused) =>
          // A card for an older key generation can't go out any more.
          refused._tag === "NotebookKeys.Problem" && refused.reason === "stale"
            ? Effect.sync(() => get.set(unsentCard, Option.none()))
            : Effect.void,
        ),
        // The summary leaves the card out until its code showed, either way.
        Effect.ensuring(refresh(accountId, get)),
      );

      get.set(unsentCard, Option.none());

      return text;
    }),
  ),
);

/**
 * The new account's Notfallkarte until the student saved it, so a restart shows the same card. A
 * sign-up writes it to the account's secrets; a public computer hands it over in memory
 * (`Offered.newCard`), and this atom moves it to the account's memory secrets.
 */
export const unsavedCard = Atom.family((accountId: string) =>
  runtime(accountId).atom((get) =>
    Effect.gen(function* () {
      const offered = ofAccount(accountId)(get(Offered.newCard));

      if (Option.isSome(offered)) {
        yield* NotebookKeys.holdCard(offered.value.code, offered.value.withPasskey);
        // Reads this atom again, which then finds the card in the secrets.
        get.set(Offered.newCard, Option.none());
      }

      return yield* NotebookKeys.heldCard;
    }),
  ),
);

/**
 * "Ich habe ihn aufgeschrieben" (`NotebookKeys.saveHeldCard`). The key status sent the card as soon
 * as the key existed, so this retries only a send that failed, and refreshes the status it may
 * have settled.
 */
export const sendUnsavedCard = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.gen(function* () {
      const held = yield* NotebookKeys.heldCard;
      const publicComputer = yield* Device.PublicComputer;
      const cardOnly = Option.filter(held, (card) => !card.withPasskey);

      // A card-only account's card signs in since its sign-up, so the device makes the sign-in
      // fresh with it. Anyone holding this device could type the code shown anyway.
      yield* NotebookKeys.saveHeldCard.pipe(
        Effect.catchTags({
          "NotebookKeys.Problem": (refused) =>
            refused.reason !== "not-fresh" || Option.isNone(cardOnly)
              ? Effect.fail(refused)
              : Effect.andThen(
                  Account.signInWithCard(Redacted.value(cardOnly.value.text), publicComputer),
                  NotebookKeys.saveHeldCard,
                ),
        }),
        Effect.ensuring(refresh(accountId, get)),
      );
    }),
  ),
);

/** The student has the card: the device forgets it, and the first start goes on. */
export const releaseUnsavedCard = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.andThen(
      NotebookKeys.releaseCard,
      Effect.sync(() => get.refresh(unsavedCard(accountId))),
    ),
  ),
);

/**
 * A new sign-in with the typed card: "Kurz bestätigen" by Notfallkarte, which also opens a locked
 * notebook.
 */
export const withCard = Atom.family((accountId: string) =>
  runtime(accountId).fn<string>()((typed, get) =>
    Effect.gen(function* () {
      const { code } = yield* Account.signInWithCard(typed, yield* Device.PublicComputer);

      yield* NotebookKeys.useCard(code);
      yield* refresh(accountId, get);
    }),
  ),
);

/**
 * The read-back that ends the card step when the account has no passkey (D97 Q7): the code typed
 * once more must be the unsaved card's, and it signs in, which proves the server knows it.
 */
export const readBack = Atom.family((accountId: string) =>
  runtime(accountId).fn<string>()((typed, get) =>
    Effect.gen(function* () {
      const held = yield* NotebookKeys.heldCard;
      const code = yield* NotebookKeys.typedCard(typed);

      if (Option.isSome(held) && !NotebookKeys.sameCard(held.value.code, code)) {
        return yield* new NotebookKeys.Problem({ reason: "not-this-card" });
      }

      yield* Account.signInWithCard(typed, yield* Device.PublicComputer);
      yield* NotebookKeys.releaseCard;
      yield* Effect.sync(() => get.refresh(unsavedCard(accountId)));
    }),
  ),
);

/** What a new passkey can do for the notebook. */
export type NewPasskey = "opens" | "signs-in-only";

/**
 * "Passkey hinzufügen": registers a passkey and, when it has PRF, a wrapper for it. An
 * authenticator that only says PRF works takes one more prompt for the output (recovery.md, 4).
 */
export const addPasskey = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.gen(function* () {
      const store = yield* SessionStore.Service;
      const token = Option.flatMap(yield* store.current, (signed) => signed.token);

      if (Option.isNone(token)) return yield* new NotebookKeys.Problem({ reason: "signed-out" });

      const added = yield* Account.addPasskey(token.value, yield* Device.PublicComputer);

      const output = yield* Passkeys.CreatedPrf.$match(added.prf, {
        Output: ({ output: bytes }) => Effect.succeedSome(Redacted.make(bytes)),
        Enabled: () => Account.passkeyOutput(added.credentialId),
        Unsupported: () => Effect.succeedNone,
      });

      if (Option.isSome(output)) {
        yield* NotebookKeys.addPasskeyWrapper(added.credentialId, output.value);
      }

      yield* refresh(accountId, get);

      return Option.isSome(output) ? ("opens" as const) : ("signs-in-only" as const);
    }),
  ),
);
