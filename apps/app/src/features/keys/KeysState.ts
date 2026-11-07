import { useAtomValue } from "@effect/atom-react";
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
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";
import { layer as authenticator } from "../../infra/passkeys/platform.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Account } from "../account/Account.ts";
import { AccountState } from "../account/AccountState.ts";
import { KeyServer } from "./KeyServer.ts";
import { NotebookKeys } from "./NotebookKeys.ts";
import { OfferedPrf } from "./OfferedPrf.ts";

// The notebook's key on this device as atoms for the screens, on the account's engine.

export * as KeysState from "./KeysState.ts";

const unreachable = { RpcClientError: () => Effect.fail(new KeyServer.Unreachable()) };

/** `KeyServer` over HTTP, with the token of the engine's session at each call. */
const keyServer = Layer.effect(KeyServer.Service)(
  Effect.gen(function* () {
    const client = yield* RpcClient.make(Keys.Rpcs);

    return KeyServer.Service.of({
      state: client["Keys.state"]().pipe(Effect.catchTags({ ...unreachable })),
      init: (record, wrapper) =>
        client["Keys.init"]({ record, wrapper }).pipe(Effect.catchTags({ ...unreachable })),
      addWrapper: (wrapper) =>
        client["Keys.addWrapper"]({ wrapper }).pipe(Effect.catchTags({ ...unreachable })),
      fetchSeals: (method) =>
        client["Keys.fetchSeals"]({ method }).pipe(Effect.catchTags({ ...unreachable })),
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
export const mismatch = Atom.family((_accountId: string) => Atom.make(false).pipe(Atom.keepAlive));

/** Why the passkey of the last sign-in couldn't open the notebook, for "Notizbuch entsperren". */
export const prfProblem = Atom.make(Option.none<NotebookKeys.Reason>()).pipe(Atom.keepAlive);

/**
 * Where this device stands with the notebook's key. Reading it starts a new account's key. A PRF
 * output that a passkey sign-in or registration left then unlocks a locked device, or adds the
 * passkey's wrapper on an unlocked one.
 */
export const status = Atom.family((accountId: string) =>
  runtime(accountId).atom((get) =>
    Effect.gen(function* () {
      const before = yield* NotebookKeys.status;

      const offered = Option.filter(
        get(OfferedPrf.waiting),
        (used) => used.accountId === accountId,
      );

      if (Option.isSome(offered)) {
        const used = yield* Effect.result(
          NotebookKeys.usePasskey(offered.value.credentialId, offered.value.prf),
        );

        get.set(
          prfProblem,
          before._tag === "Locked" &&
            used._tag === "Failure" &&
            used.failure._tag === "NotebookKeys.Problem"
            ? Option.some(used.failure.reason)
            : Option.none(),
        );

        // Cleared last: clearing it reads this atom again, which would interrupt the unlock.
        get.set(OfferedPrf.waiting, Option.none());
      }

      const now = Option.isSome(offered) ? yield* NotebookKeys.status : before;

      // The device's own wrapper and generation 0 reach the server after the screen moved on,
      // in the engine's scope, so sign-out stops it.
      if (now._tag === "Unlocked") {
        const flag = (matches: boolean) =>
          Effect.sync(() => get.set(mismatch(accountId), !matches));

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
const unsentCard = Atom.family((_accountId: string) =>
  Atom.make(Option.none<NotebookKeys.Card>()).pipe(Atom.keepAlive),
);

/** "Notizbuch-Schlüssel": the methods the server holds, and whether one survives this device. */
export const summary = Atom.family((accountId: string) =>
  // After the status, which starts a new account's key when this screen is the first to ask.
  runtime(accountId).atom((get) =>
    Effect.andThen(get.result(status(accountId)), () =>
      NotebookKeys.summary(
        new Set(
          Option.toArray(
            Option.map(get(unsentCard(accountId)), (card) => card.wrapper.statement.id),
          ),
        ),
      ),
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
      const used = yield* Account.signInWithPasskey();

      yield* NotebookKeys.usePasskey(used.credentialId, used.prf);
      yield* refresh(accountId, get);
    }),
  ),
);

/** The password confirmation that makes the sign-in fresh, where the account has no passkey. */
export const withPassword = Atom.family((accountId: string) =>
  runtime(accountId).fn<{ readonly email: string; readonly password: string }>()(
    ({ email, password }) => Account.signIn(email, password),
  ),
);

/**
 * "Notfallkarte erstellen": the new code's text, which the screen shows once and keeps nowhere.
 * Fails with "not-fresh" when the sign-in is older than `Keys.freshSignInMinutes`.
 */
export const createRecoveryCode = Atom.family((accountId: string) =>
  runtime(accountId).fn<void>()((_, get) =>
    Effect.gen(function* () {
      const waiting = get(unsentCard(accountId));
      const card = Option.isSome(waiting) ? waiting.value : yield* NotebookKeys.newRecoveryCode;

      get.set(unsentCard(accountId), Option.some(card));

      const text = yield* NotebookKeys.sendRecoveryCode(card).pipe(
        Effect.tapError((refused) =>
          // A card for an older key generation can't go out any more.
          refused._tag === "NotebookKeys.Problem" && refused.reason === "stale"
            ? Effect.sync(() => get.set(unsentCard(accountId), Option.none()))
            : Effect.void,
        ),
      );

      get.set(unsentCard(accountId), Option.none());
      yield* refresh(accountId, get);

      return text;
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

      const added = yield* Account.addPasskey(token.value);

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
