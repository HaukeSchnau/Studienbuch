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
    Layer.mergeAll(keyServer, NotebookKeys.keyring, NotebookKeys.guard, authenticator).pipe(
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

/** Whether the account's engine reaches the server, for a key status that waits for it. */
const connected = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Stream.unwrap(Effect.map(SyncClient.Service, (sync) => sync.status.changes)).pipe(
      Stream.map((status) => status.connection === "online"),
      Stream.changes,
    ),
  ),
);

/**
 * Where this device stands with the notebook's key, through `NotebookKeys.settle`: reading it starts
 * a new account's key and puts a pending Notfallkarte to work. A card or a PRF output a sign-in or
 * sign-up left (`Offered`) joins first. A step the network stopped runs again once the account's
 * engine reaches the server.
 */
export const status = Atom.family((accountId: string) =>
  runtime(accountId).atom((get) =>
    Effect.gen(function* () {
      const mine = ofAccount(accountId);
      const passkey = mine(get(Offered.prf));
      const card = mine(get(Offered.card));

      const settled = Option.isSome(card)
        ? yield* NotebookKeys.takeCard(card.value)
        : yield* NotebookKeys.settle;

      const used = Option.isSome(passkey)
        ? Option.some(
            yield* Effect.result(
              NotebookKeys.usePasskey(passkey.value.credentialId, passkey.value.prf),
            ),
          )
        : Option.none();

      const now = Option.isSome(used) ? yield* NotebookKeys.status : settled.status;

      const passkeyProblem = Option.flatMap(used, (result) =>
        result._tag === "Failure" && result.failure._tag === "NotebookKeys.Problem"
          ? Option.some(result.failure.reason)
          : Option.none(),
      );

      get.set(
        signInProblem,
        now._tag === "Locked" ? Option.orElse(passkeyProblem, () => settled.card) : Option.none(),
      );

      // The device's own wrapper and generation 0 reach the server after the screen moved on,
      // in the engine's scope, so sign-out stops it.
      if (now._tag === "Unlocked") {
        const flag = (matches: boolean) => Effect.sync(() => get.set(mismatch, !matches));

        yield* Effect.forkIn(
          Effect.ignore(Effect.flatMap(NotebookKeys.reconcile, flag)),
          yield* AccountEngine.EngineScope,
        );
      }

      // A passkey's wrapper that went offline waits on the device, and goes out from here too.
      const offline =
        now._tag === "Offline" ||
        Option.contains(settled.card, "offline") ||
        Option.contains(settled.passkey, "offline") ||
        Option.contains(passkeyProblem, "offline");

      if (offline) get(connected(accountId));

      // Cleared last: clearing one reads this atom again, which would interrupt the work above.
      // The card is in the account's secrets by now, and so is a passkey's output unless the
      // device couldn't store it, so a second run finds them there.
      if (Option.isSome(card)) get.set(Offered.card, Option.none());

      const handedOver = Option.exists(
        used,
        (result) => result._tag === "Success" || result.failure._tag === "NotebookKeys.Problem",
      );

      if (handedOver) get.set(Offered.prf, Option.none());

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

// The summary reads the status, so refreshing the status alone runs both again, in order. Through
// the registry, as a confirmation's run can outlive its atom's context (`oneAttempt`).
const refresh = (accountId: string, get: Atom.FnContext) =>
  Effect.sync(() => get.registry.refresh(status(accountId)));

// The confirmations that sign in again run as the device's one attempt (`Account.attempt`), with
// the sign-in screens. A second call of the same one must meet that refusal rather than interrupt
// the first, so their atoms run `concurrent`.
const oneAttempt = { concurrent: true };

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
  runtime(accountId).fn<void>()(
    (_, get) =>
      Effect.gen(function* () {
        const used = yield* Account.attempt(
          Account.signInWithPasskey(yield* Device.PublicComputer),
        );

        yield* NotebookKeys.usePasskey(used.credentialId, used.prf);
        yield* refresh(accountId, get);
      }),
    oneAttempt,
  ),
);

/** The password confirmation that makes the sign-in fresh, where the account has no passkey. */
export const withPassword = Atom.family((accountId: string) =>
  runtime(accountId).fn<{ readonly email: string; readonly password: string }>()(
    ({ email, password }) =>
      Effect.flatMap(Device.PublicComputer, (publicComputer) =>
        Account.attempt(Account.signIn(email, password, publicComputer)),
      ),
    oneAttempt,
  ),
);

/**
 * "Notfallkarte erstellen" (`NotebookKeys.replaceCard`): the new code's text, which the screen
 * shows until the student saved it (`cardSaved`). Fails with "not-fresh" when the sign-in is older
 * than `Keys.freshSignInMinutes`.
 */
export const createRecoveryCode = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    NotebookKeys.replaceCard.pipe(Effect.ensuring(refresh(accountId, get))),
  ),
);

/**
 * The Notfallkarte the device still has work for (`NotebookKeys.PendingCard`). The card step shows
 * it while the student hasn't saved it. It reads again after each key status, which may have taken
 * a card in or put one to work, and fails while a card waits that the device couldn't keep.
 */
export const pendingCard = Atom.family((accountId: string) =>
  runtime(accountId).atom((get) => {
    const now = get(status(accountId));
    const offered = ofAccount(accountId)(get(Offered.card));

    // A card the key status couldn't take in is neither held nor gone, so the step waits for it.
    if (Option.isSome(offered) && AsyncResult.isFailure(now)) return Effect.failCause(now.cause);

    return NotebookKeys.pendingCard;
  }),
);

/** Tries again to take the card in and read it, after the device's store refused. */
export const retryCard = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.sync(() => {
      get.refresh(status(accountId));
      get.refresh(pendingCard(accountId));
    }),
  ),
);

// The account's runtime settles cards itself, so its sign-ins hand none to `Offered`.
const kept: Account.Offer = { give: () => Effect.void, withdraw: () => Effect.void };

/**
 * "Ich habe ihn aufgeschrieben": the key status sent the card as soon as the key existed, so this
 * settles again only to be sure the server holds it, and resends a first key whose answer was lost
 * on the way. A card-only account whose sign-in went stale signs in again with this card, which
 * anyone holding the device could type from the screen anyway.
 */
export const saveCard = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()(
    (_, get) =>
      Effect.gen(function* () {
        const settled = yield* NotebookKeys.settle;

        const cardOnly = Option.filter(
          yield* NotebookKeys.pendingCard,
          (card) => !card.endsAtSaved,
        );

        const again =
          Option.contains(settled.card, "not-fresh") && Option.isSome(cardOnly)
            ? yield* Effect.andThen(
                Account.attempt(
                  Account.signInWithCard(
                    Redacted.value(cardOnly.value.text),
                    yield* Device.PublicComputer,
                    kept,
                  ),
                ),
                NotebookKeys.settle,
              )
            : settled;

        if (Option.isSome(again.card)) {
          return yield* new NotebookKeys.Problem({ reason: again.card.value });
        }
      }).pipe(Effect.ensuring(refresh(accountId, get))),
    oneAttempt,
  ),
);

/** "Weiter": the card step heard that a newer card replaced this one (`NotebookKeys.leaveCard`). */
export const leaveCard = Atom.family((accountId: string) =>
  runtime(accountId).fn<NotebookKeys.PendingCard>()((card, get) =>
    Effect.andThen(NotebookKeys.leaveCard(card.code), refresh(accountId, get)),
  ),
);

/** The student has the card: the card step ends (`NotebookKeys.cardSaved`). */
export const cardSaved = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.andThen(NotebookKeys.cardSaved, refresh(accountId, get)),
  ),
);

/**
 * A new sign-in with the typed card: "Kurz bestätigen" by Notfallkarte. The card joins the key
 * state, which finds the server holds it.
 */
export const withCard = Atom.family((accountId: string) =>
  runtime(accountId).fn<string>()(
    (typed, get) =>
      Effect.gen(function* () {
        yield* Account.attempt(Account.signInWithCard(typed, yield* Device.PublicComputer, kept));
        const settled = yield* NotebookKeys.settle;

        if (Option.isSome(settled.card)) {
          return yield* new NotebookKeys.Problem({ reason: settled.card.value });
        }
      }).pipe(Effect.ensuring(refresh(accountId, get))),
    oneAttempt,
  ),
);

/**
 * The read-back that ends the card step when the account has no passkey (D97 Q7): the code typed
 * once more must be the pending card's, and it signs in, which proves the server knows it.
 */
export const readBack = Atom.family((accountId: string) =>
  runtime(accountId).fn<string>()(
    (typed, get) =>
      Effect.gen(function* () {
        const held = yield* NotebookKeys.pendingCard;
        const code = yield* NotebookKeys.typedCard(typed);

        if (Option.isSome(held) && !NotebookKeys.sameCard(held.value.code, code)) {
          return yield* new NotebookKeys.Problem({ reason: "not-this-card" });
        }

        yield* Account.attempt(Account.signInWithCard(typed, yield* Device.PublicComputer, kept));
        yield* NotebookKeys.cardSaved;
      }).pipe(Effect.ensuring(refresh(accountId, get))),
    oneAttempt,
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
