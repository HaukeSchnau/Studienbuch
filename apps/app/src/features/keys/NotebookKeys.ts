import { Keys } from "@stu/api/Keys";
import { AccountKey, CryptoSuite, type E2ee, RecoveryCode, Wrapper } from "@stu/e2ee";
import { Ids } from "@stu/sync";
import { Ports, SyncClient } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Hex from "effect/encoding/Hex";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { KeyServer } from "./KeyServer.ts";

// The notebook's root key on this device (recovery.md, sections 1 and 2). A recovered key counts
// only after `Wrapper.recover` checked the anchor, every chain link and the newest endorsement. A
// key straight from the server (`Demo.rootKey`) counts only for an account the user signed in to
// with a password at a demo address (ADR 0027), so the server can't plant a key on any other.

export * as NotebookKeys from "./NotebookKeys.ts";

/** Where a root key goes once the device trusts it: the engine's keyring, which then opens what waited. */
export class Keyring extends Context.Service<
  Keyring,
  { readonly unlock: (keys: AccountKey.Keys) => Effect.Effect<void, Ports.SecretsUnavailable> }
>()("NotebookKeys.Keyring") {}

export const keyring = Layer.effect(Keyring)(
  Effect.map(SyncClient.Service, (sync) =>
    Keyring.of({
      unlock: (keys) => sync.unlock(keys).pipe(Effect.catchTags({ SqlError: Effect.die })),
    }),
  ),
);

/** Where this device stands with the notebook's key. */
export type Status = Data.TaggedEnum<{
  /** The device holds the root key. */
  Unlocked: {};
  /** The account has a key, and this device doesn't hold it: "Notizbuch entsperren". */
  Locked: {};
  /** The device holds no key, and the server didn't answer, so it can't tell which of the two. */
  Offline: {};
  /** A public computer forgets the key at sign-out, so it never starts an account's notebook. */
  NotHere: {};
}>;

export const Status = Data.taggedEnum<Status>();

/**
 * Whether the device can read the notebook: `None` only while the status loads. A status that
 * failed counts as locked, so the screens offer "Notizbuch entsperren", which reads it again.
 */
export const unlocked = (status: AsyncResult.AsyncResult<Status, unknown>) =>
  AsyncResult.isInitial(status)
    ? Option.none()
    : Option.some(Option.exists(AsyncResult.value(status), (now) => now._tag === "Unlocked"));

export const Reason = Schema.Literals([
  "typo",
  "length",
  "no-match",
  "passkey-no-match",
  "untrusted",
  "update",
  "too-many",
  "offline",
  "not-fresh",
  "stale",
  "locked",
  "signed-out",
  "not-this-card",
]);

export type Reason = typeof Reason.Type;

/** Why a key operation didn't happen, in words a screen can show (`sentence`). */
export class Problem extends Schema.TaggedError<Problem, { readonly brand: unique symbol }>()(
  "NotebookKeys.Problem",
  { reason: Reason },
) {}

export const sentence: Record<Reason, string> = {
  typo: "Da stimmt ein Zeichen nicht. Vergleich den Code noch einmal mit deiner Karte.",
  length: "Der Code hat 28 Zeichen. Vergleich ihn noch einmal mit deiner Karte.",
  "no-match":
    "Diese Notfallkarte passt nicht zu deinem Konto. Vielleicht ist es eine ältere Karte, die du ersetzt hast, oder die Karte eines anderen Kontos.",
  "passkey-no-match":
    "Du bist angemeldet. Dein Passkey kann dein Notizbuch auf diesem Gerät nicht öffnen. Nimm ein anderes Gerät oder deine Notfallkarte.",
  untrusted:
    "Der Schlüssel vom Server passt nicht zu deinem Konto, deshalb bleibt dein Notizbuch gesperrt.",
  update: "Diese Version der App kennt deinen Schlüssel noch nicht. Aktualisiere die App.",
  "too-many": "Zu viele Versuche. Probier es morgen wieder.",
  offline: "Dafür brauchst du einmal Internet.",
  "not-fresh": "Melde dich kurz neu an, dann geht es weiter.",
  stale: "Der Schlüssel auf diesem Gerät ist nicht mehr aktuell.",
  locked: "Entsperre zuerst dein Notizbuch.",
  "signed-out": "Deine Anmeldung ist abgelaufen. Melde dich neu an.",
  "not-this-card":
    "Das ist nicht der Code von dieser Karte. Vergleich ihn noch einmal mit deiner Notfallkarte.",
};

const problem = (reason: Reason) => new Problem({ reason });

/** How every server call's common failures read on a screen, spread into `catchTags`. */
const fromServer = {
  "KeyServer.Unreachable": () => Effect.fail(problem("offline")),
  "Keys.SignedOut": () => Effect.fail(problem("signed-out")),
};

const accountId = Effect.map(Ports.Session, (session) => session.accountId);

const rootKeyLength = 32;

/** The root key this device holds. */
const heldRootKey = Effect.map(
  Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("root-key")),
  (held) =>
    Option.map(
      Option.filter(held, (bytes) => bytes.length === rootKeyLength),
      (bytes) => Redacted.make(bytes),
    ),
);

const heldSeed = Effect.map(
  Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("device-seed")),
  Option.map((bytes) => Redacted.make(bytes)),
);

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, index) => byte === b[index]);

/** A new wrapper of `kind` for `secret`. Our own keys and formats can't fail it, so it dies. */
const wrap = Effect.fn("NotebookKeys.wrap")(function* (
  kind: Wrapper.Kind,
  secret: Redacted.Redacted<Uint8Array>,
  keys: AccountKey.Keys,
  where: {
    readonly place?: Wrapper.Method["place"];
    readonly credentialId?: string;
    readonly id?: string;
  } = {},
) {
  const id = where.id ?? (yield* Ids.random);
  const method = { id, kind, place: where.place ?? "", credentialId: where.credentialId ?? "" };

  return new Keys.Sealed(yield* Effect.orDie(Wrapper.create(method, secret, keys)));
});

const firstRecord = (keys: AccountKey.Keys) => Effect.orDie(AccountKey.record(keys, "first"));

/**
 * The keys of the newest record, if this device's root key derives them for the signed-in account.
 * A device whose key the newest generation doesn't match never writes under it.
 */
const ownKeys = Effect.fn("NotebookKeys.ownKeys")(function* (
  rootKey: Redacted.Redacted<Uint8Array>,
  records: ReadonlyArray<AccountKey.Record>,
) {
  const account = yield* accountId;
  const newest = records.at(-1);

  if (newest === undefined || newest.accountId !== account) return Option.none<AccountKey.Keys>();

  const keys = yield* Effect.orDie(AccountKey.derive(rootKey, account, newest.generation));

  return AccountKey.matches(keys, newest) ? Option.some(keys) : Option.none();
});

/** The account's keys on this device for adding a method: unlocked, and the newest generation. */
const current = Effect.gen(function* () {
  const rootKey = yield* heldRootKey;

  if (Option.isNone(rootKey)) return yield* problem("locked");

  const state = yield* (yield* KeyServer.Service).state.pipe(Effect.catchTags({ ...fromServer }));

  const keys = yield* ownKeys(rootKey.value, state.records);

  if (Option.isNone(keys)) return yield* problem("stale");

  return { keys: keys.value, state };
});

/**
 * Makes sure the server holds this device's generation 0 and device wrapper, after a lost answer
 * or a restore, and the card of a new account that the device still holds. Answers whether the
 * account's key chain is this device's. It publishes only the device's own record and never adopts
 * another chain. M1 has generation 0 only.
 */
export const reconcile = Effect.gen(function* () {
  const rootKey = yield* heldRootKey;
  const seed = yield* heldSeed;

  if (Option.isNone(rootKey)) return true;
  const server = yield* KeyServer.Service;
  const state = yield* server.state.pipe(Effect.catchTags({ ...fromServer }));

  if (state.records.length === 0) {
    if (Option.isNone(seed)) return true;
    const keys = yield* Effect.orDie(AccountKey.derive(rootKey.value, yield* accountId, 0));
    const wrapper = yield* wrap("device", seed.value, keys);

    return yield* server.init(yield* firstRecord(keys), wrapper).pipe(
      Effect.as(true),
      Effect.catchTags({
        ...fromServer,
        "Keys.ChainExists": () => Effect.succeed(false),
        "Keys.KeysLost": () => Effect.succeed(false),
        "Keys.Invalid": Effect.die,
      }),
    );
  }

  const keys = yield* ownKeys(rootKey.value, state.records);

  if (Option.isNone(keys)) return false;

  // A new account's card goes out as soon as the key exists, while the sign-up is fresh: the
  // device may be gone before the student finishes the card step.
  const held = yield* heldCard;

  if (Option.isSome(held)) {
    yield* sendCard(held.value.code, keys.value, state).pipe(
      Effect.catchTags({
        "NotebookKeys.Problem": (refused) =>
          Effect.logWarning(`The new card's wrapper didn't go out: ${refused.reason}`),
      }),
    );
  }

  if (Option.isNone(seed)) return true;
  const own = yield* Effect.orDie(Wrapper.derive("device", seed.value, keys.value.accountId));

  const listed = state.wrappers.some(
    ({ statement }) =>
      statement.kind === Wrapper.kindByte.device && sameBytes(statement.publicKey, own.publicKey),
  );

  if (listed) return true;

  yield* server.addWrapper(yield* wrap("device", seed.value, keys.value), Option.none()).pipe(
    Effect.catchTags({
      ...fromServer,
      // This session added its device's wrapper already, under another seed.
      "Keys.Invalid": () => Effect.logWarning("The server took no device wrapper"),
      "Keys.Stale": () => Effect.logWarning("The account renewed its key"),
      "Keys.NotFresh": Effect.die,
    }),
  );

  return true;
});

/** A first device's new root key, its device seed and its wrapper's id, until the server took them. */
interface Pending {
  readonly rootKey: Redacted.Redacted<Uint8Array>;
  readonly seed: Redacted.Redacted<Uint8Array>;
  readonly wrapperId: string;
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

// `pending-key` holds R(32) || seed(32) || UTF-8 of the wrapper's id.
const heldPending = Effect.map(
  Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("pending-key")),
  Option.flatMap((bytes) =>
    bytes.length > 2 * rootKeyLength
      ? Option.some<Pending>({
          rootKey: Redacted.make(bytes.slice(0, rootKeyLength)),
          seed: Redacted.make(bytes.slice(rootKeyLength, 2 * rootKeyLength)),
          wrapperId: textDecoder.decode(bytes.slice(2 * rootKeyLength)),
        })
      : Option.none(),
  ),
);

const newPending = Effect.gen(function* () {
  const suite = yield* CryptoSuite.Service;

  const pending: Pending = {
    rootKey: Redacted.make(yield* suite.randomBytes(rootKeyLength)),
    seed: Redacted.make(yield* suite.randomBytes(rootKeyLength)),
    wrapperId: yield* Ids.random,
  };

  yield* (yield* Ports.DeviceSecrets).set(
    "pending-key",
    new Uint8Array([
      ...Redacted.value(pending.rootKey),
      ...Redacted.value(pending.seed),
      ...textEncoder.encode(pending.wrapperId),
    ]),
  );

  return pending;
});

/**
 * The first device makes the root key and its device wrapper, kept as `pending-key` until the
 * server took them, so a lost answer resends them. It stays locked when another chain won, or when
 * the server lost the key a sealed notebook still uses (`KeysLost`).
 */
const start = Effect.gen(function* () {
  const secrets = yield* Ports.DeviceSecrets;
  const held = yield* heldPending;
  const pending = Option.isSome(held) ? held.value : yield* newPending;
  const keys = yield* Effect.orDie(AccountKey.derive(pending.rootKey, yield* accountId, 0));
  const wrapper = yield* wrap("device", pending.seed, keys, { id: pending.wrapperId });

  const published = yield* (yield* KeyServer.Service).init(yield* firstRecord(keys), wrapper).pipe(
    Effect.as(true),
    Effect.catchTags({
      "Keys.ChainExists": () => Effect.succeed(false),
      "Keys.KeysLost": () => Effect.succeed(false),
      "Keys.Invalid": Effect.die,
    }),
  );

  if (published) {
    yield* secrets.set("device-seed", Redacted.value(pending.seed));
    yield* (yield* Keyring).unlock(keys);
  }

  yield* secrets.remove("pending-key");

  return published ? Status.Unlocked() : Status.Locked();
});

/** The user signed in to this account with a password at a demo account's address. */
const demoSignIn = Effect.gen(function* () {
  const account = yield* accountId;
  const signed = yield* (yield* SessionStore.Service).current;

  return Option.exists(signed, (each) => each.accountId === account && each.demo);
});

/**
 * A demo account's root key, which the server derives (ADR 0027). The device takes it only if it
 * derives the account's newest record. It keeps no device seed, so it publishes no wrapper, and
 * every device of the account asks again.
 */
const demoUnlock = Effect.fn("NotebookKeys.demoUnlock")(function* (
  records: ReadonlyArray<AccountKey.Record>,
) {
  const rootKey = yield* (yield* KeyServer.Service).demoRootKey;

  if (Option.isNone(rootKey)) return Status.Locked();

  const keys = yield* ownKeys(rootKey.value, records);

  if (Option.isNone(keys)) {
    yield* Effect.logWarning("The demo key doesn't derive the account's key record");

    return Status.Locked();
  }

  yield* (yield* Keyring).unlock(keys.value);

  return Status.Unlocked();
});

/**
 * Where this device stands. A device without a key asks the server, and the first device of an
 * account starts the notebook's key right away.
 */
export const status = Effect.gen(function* () {
  if (Option.isSome(yield* heldRootKey)) return Status.Unlocked();

  const offline = () => Effect.succeed(Status.Offline());

  const state = yield* (yield* KeyServer.Service).state.pipe(
    Effect.asSome,
    Effect.catchTags({
      "KeyServer.Unreachable": () => Effect.succeedNone,
      "Keys.SignedOut": () => Effect.succeedNone,
    }),
  );

  if (Option.isNone(state)) return Status.Offline();
  const { records } = state.value;

  // A first device whose init answer was lost finds its own record there, and sends it again.
  if (records.length > 0 && Option.isNone(yield* heldPending)) {
    if (!(yield* demoSignIn)) return Status.Locked();

    return yield* demoUnlock(records).pipe(
      Effect.catchTags({ "KeyServer.Unreachable": offline, "Keys.SignedOut": offline }),
    );
  }

  if (records.length === 0 && (yield* Device.PublicComputer)) {
    return Status.NotHere();
  }

  return yield* start.pipe(
    Effect.catchTags({ "KeyServer.Unreachable": offline, "Keys.SignedOut": offline }),
  );
});

/**
 * Keeps a root key the device just recovered, with a seed for its own device wrapper unless it's a
 * public computer or has one already. `reconcile` publishes the wrapper after the unlock.
 */
const adopt = Effect.fn("NotebookKeys.adopt")(function* (keys: AccountKey.Keys) {
  if (!(yield* Device.PublicComputer) && Option.isNone(yield* heldSeed)) {
    const seed = yield* (yield* CryptoSuite.Service).randomBytes(rootKeyLength);
    yield* (yield* Ports.DeviceSecrets).set("device-seed", seed);
  }

  yield* (yield* Keyring).unlock(keys);
});

/** How bad a failed recovery is, so the worst one names the reason. */
const severity = (error: E2ee.Failure) =>
  error._tag === "E2ee.Untrusted" ? 2 : error._tag === "E2ee.Unsupported" ? 1 : 0;

const reasonFor = (kind: "prf" | "code", worst: Option.Option<E2ee.Failure>): Reason => {
  const tag = Option.match(worst, { onNone: () => "none", onSome: (failure) => failure._tag });

  if (tag === "E2ee.Untrusted") return "untrusted";

  if (tag === "E2ee.Unsupported") return "update";

  return kind === "prf" ? "passkey-no-match" : "no-match";
};

/** Tries every wrapper the server sent for the method, and keeps the first key that checks out. */
const recoverWith = Effect.fn("NotebookKeys.recoverWith")(function* (
  kind: "prf" | "code",
  secret: Redacted.Redacted<Uint8Array>,
  fetchFor: Keys.Method,
) {
  const account = yield* accountId;

  const seals = yield* (yield* KeyServer.Service).fetchSeals(fetchFor).pipe(
    Effect.catchTags({
      ...fromServer,
      "Keys.TooManyAttempts": () => Effect.fail(problem("too-many")),
    }),
  );

  let worst = Option.none<E2ee.Failure>();

  for (const { statement, seal } of seals.wrappers) {
    const opened = yield* Effect.result(
      Wrapper.recover(kind, secret, account, statement, seal, seals.records),
    );

    if (Result.isSuccess(opened)) return yield* adopt(opened.success);

    if (Option.isNone(worst) || severity(opened.failure) > severity(worst.value)) {
      worst = Option.some(opened.failure);
    }
  }

  return yield* problem(reasonFor(kind, worst));
});

/** A card's code as typed, checked on the device, so a typo never reaches the server. */
export const typedCard = (typed: string) =>
  Result.match(RecoveryCode.parse(typed), {
    onSuccess: Effect.succeed,
    onFailure: ({ reason }) => Effect.fail(problem(reason === "length" ? "length" : "typo")),
  });

/** What the card signs in with (`RecoveryCode.login`), as `Accounts.Login` sends it. */
export const cardLogin = Effect.fn("NotebookKeys.cardLogin")(function* (
  code: Redacted.Redacted<Uint8Array>,
) {
  const login = yield* RecoveryCode.login(code);

  return Redacted.make(Base64Url.encode(Redacted.value(login)));
});

/** "Mit der Notfallkarte": the code as typed. A typo stops before anything leaves the device. */
export const unlockWithCode = Effect.fn("NotebookKeys.unlockWithCode")(function* (typed: string) {
  yield* recoverWith("code", yield* typedCard(typed), Keys.RecoveryCode.make({}));
});

/** Sends a wrapper. A card's goes with its login, which signs in to an account without an address. */
const add = (wrapper: Keys.Sealed, login = Option.none<Redacted.Redacted>()) =>
  Effect.flatMap(KeyServer.Service, (server) => server.addWrapper(wrapper, login)).pipe(
    Effect.catchTags({
      ...fromServer,
      "Keys.NotFresh": () => Effect.fail(problem("not-fresh")),
      "Keys.Stale": () => Effect.fail(problem("stale")),
      "Keys.Invalid": Effect.die,
    }),
  );

/** Adds a `prf` wrapper for a passkey whose output opens none of its wrappers yet. */
export const addPasskeyWrapper = Effect.fn("NotebookKeys.addPasskeyWrapper")(function* (
  credentialId: string,
  prf: Redacted.Redacted<Uint8Array>,
) {
  const { keys, state } = yield* current;
  const derived = yield* Effect.orDie(Wrapper.derive("prf", prf, keys.accountId));

  const ofPasskey = state.wrappers.filter(
    ({ statement }) =>
      statement.kind === Wrapper.kindByte.prf && statement.credentialId === credentialId,
  );

  const known = ofPasskey.some(({ statement }) =>
    sameBytes(statement.publicKey, derived.publicKey),
  );

  if (known || ofPasskey.length >= Keys.wrappersPerPasskey) return;

  yield* add(yield* wrap("prf", prf, keys, { credentialId }));
});

/**
 * A passkey's PRF output, from a sign-in or "Mit Passkey". A locked device, or one whose key the
 * account renewed elsewhere, unlocks with it. An up-to-date one adds a wrapper when the output
 * opens none of the passkey's (self-healing, recovery.md section 4), as long as the passkey has
 * fewer than `Keys.wrappersPerPasskey`.
 */
export const usePasskey = Effect.fn("NotebookKeys.usePasskey")(function* (
  credentialId: string,
  prf: Option.Option<Redacted.Redacted<Uint8Array>>,
) {
  const locked = Option.isNone(yield* heldRootKey);

  if (Option.isNone(prf)) return locked ? yield* problem("passkey-no-match") : undefined;
  const unlock = recoverWith("prf", prf.value, Keys.Passkey.make({ credentialId }));

  if (locked) return yield* unlock;

  yield* addPasskeyWrapper(credentialId, prf.value).pipe(
    Effect.catchTags({
      "NotebookKeys.Problem": (refused) =>
        refused.reason === "stale" ? unlock : Effect.fail(refused),
    }),
  );
});

/** A new Notfallkarte: its code's text, shown once, its wrapper for the server and its login. */
export interface Card {
  readonly text: Redacted.Redacted;
  readonly wrapper: Keys.Sealed;
  readonly login: Redacted.Redacted;
}

const UnseenCards = Schema.fromJsonString(Schema.Array(Schema.String));
const decodeUnseen = Schema.decodeEffect(UnseenCards);
const encodeUnseen = Schema.encodeEffect(UnseenCards);

/**
 * The ids of cards whose code never showed. The ids aren't secret, and they outlive a restart,
 * which forgets the code, so such a card never counts.
 */
const unseenCards = Effect.flatMap(
  Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("unseen-cards")),
  Option.match({
    onNone: () => Effect.succeed<ReadonlyArray<string>>([]),
    // Only this module writes it, so a value that doesn't parse is a defect.
    onSome: (bytes) => Effect.orDie(decodeUnseen(textDecoder.decode(bytes))),
  }),
);

const keepUnseen = Effect.fn("NotebookKeys.keepUnseen")(function* (ids: ReadonlyArray<string>) {
  const secrets = yield* Ports.DeviceSecrets;

  if (ids.length === 0) return yield* secrets.remove("unseen-cards");
  const text = yield* Effect.orDie(encodeUnseen(ids));

  yield* secrets.set("unseen-cards", textEncoder.encode(text));
});

/** "Notfallkarte erstellen": a new code and its wrapper, unseen until the server took it. */
export const newRecoveryCode = Effect.gen(function* () {
  const { keys } = yield* current;
  const code = yield* RecoveryCode.generate;
  const wrapper = yield* wrap("code", code.bytes, keys, { place: "card" });

  yield* keepUnseen([...(yield* unseenCards), wrapper.statement.id]);

  return { text: code.text, wrapper, login: yield* cardLogin(code.bytes) } satisfies Card;
});

/**
 * Sends a card's wrapper and answers its text, which the screen shows once. After a lost answer
 * the same card goes out again, so the code shown is the one the server holds.
 */
export const sendRecoveryCode = Effect.fn("NotebookKeys.sendRecoveryCode")(function* (card: Card) {
  yield* add(card.wrapper, Option.some(card.login));

  const id = card.wrapper.statement.id;
  yield* keepUnseen((yield* unseenCards).filter((each) => each !== id));

  return card.text;
});

/**
 * Makes sure the card opens the notebook and, for an account without an address, signs in: its
 * wrapper goes out with its login unless the server holds it already. The server then retires
 * the account's other cards (`KeyStore.addWrapper`).
 */
export const addCardWrapper = Effect.fn("NotebookKeys.addCardWrapper")(function* (
  code: Redacted.Redacted<Uint8Array>,
) {
  const { keys, state } = yield* current;

  yield* sendCard(code, keys, state);
});

/**
 * `addCardWrapper` with the keys and the state at hand. The wrapper's id follows from the card,
 * so two sends of one card, as the key status and the card step can make at once, store one.
 */
const sendCard = Effect.fn("NotebookKeys.sendCard")(function* (
  code: Redacted.Redacted<Uint8Array>,
  keys: AccountKey.Keys,
  state: Keys.State,
) {
  const derived = yield* Effect.orDie(Wrapper.derive("code", code, keys.accountId));

  const known = state.wrappers.some(
    ({ statement }) =>
      statement.kind === Wrapper.kindByte.code && sameBytes(statement.publicKey, derived.publicKey),
  );

  if (known) return;
  const id = `card-${Hex.encode(derived.publicKey.slice(0, 16))}`;

  yield* add(
    yield* wrap("code", code, keys, { place: "card", id }),
    Option.some(yield* cardLogin(code)),
  );
});

/**
 * A card that signed this device in: a locked device unlocks with it. An unlocked one, as the
 * account's first device is when it signed up on a public computer, makes the card open the
 * notebook too.
 */
export const useCard = Effect.fn("NotebookKeys.useCard")(function* (
  code: Redacted.Redacted<Uint8Array>,
) {
  if (Option.isNone(yield* heldRootKey)) {
    return yield* recoverWith("code", code, Keys.RecoveryCode.make({}));
  }

  yield* addCardWrapper(code);
});

/** The card of a sign-up without an address, kept on the device until the student saved it. */
export interface UnsavedCard {
  readonly code: Redacted.Redacted<Uint8Array>;
  readonly text: Redacted.Redacted;
  /** The account signed up with a passkey, so the card step offers none and asks no read-back. */
  readonly withPasskey: boolean;
}

const codeLength = 16;

// `unsaved-card` holds the card's 16 bytes and 1 if the account has a passkey, else 0.
export const holdCard = Effect.fn("NotebookKeys.holdCard")(function* (
  code: Redacted.Redacted<Uint8Array>,
  withPasskey: boolean,
) {
  yield* (yield* Ports.DeviceSecrets).set(
    "unsaved-card",
    new Uint8Array([...Redacted.value(code), withPasskey ? 1 : 0]),
  );
});

export const heldCard = Effect.map(
  Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("unsaved-card")),
  Option.flatMap((bytes) => {
    if (bytes.length !== codeLength + 1) return Option.none();
    const code = Redacted.make(bytes.slice(0, codeLength));

    return Option.some<UnsavedCard>({
      code,
      text: RecoveryCode.text(code),
      withPasskey: bytes[codeLength] === 1,
    });
  }),
);

/** Whether two codes are the same card. */
export const sameCard = (a: Redacted.Redacted<Uint8Array>, b: Redacted.Redacted<Uint8Array>) =>
  sameBytes(Redacted.value(a), Redacted.value(b));

/** The student saved the card, or signed out: the device forgets it. */
export const releaseCard = Effect.flatMap(Ports.DeviceSecrets, (secrets) =>
  secrets.remove("unsaved-card"),
);

/** One way back into the notebook, as "Notizbuch-Schlüssel" lists it. */
export interface Method {
  readonly kind: Wrapper.Kind;
  readonly thisDevice: boolean;
  /** The server's claim of when it stored the method, for display only. */
  readonly since: DateTime.Utc;
}

export interface Summary {
  /** Methods that survive losing this device: other devices, passkeys and Notfallkarten. */
  readonly secured: boolean;
  readonly methods: ReadonlyArray<Method>;
}

const kinds: ReadonlyArray<Wrapper.Kind> = ["device", "prf", "code"];

/**
 * What the server holds now, so a method lost in a restore shows as missing. Only methods the
 * newest generation endorses count, so the server can't make the notebook look safer than it is,
 * and a card whose code never showed doesn't count either.
 */
export const summary = Effect.gen(function* () {
  const unseen = new Set(yield* unseenCards);
  const { keys, state } = yield* current;
  const newest = state.records.at(-1);
  const seed = yield* heldSeed;

  const ownDevice = Option.isSome(seed)
    ? Option.some(
        (yield* Effect.orDie(Wrapper.derive("device", seed.value, keys.accountId))).publicKey,
      )
    : Option.none<Uint8Array>();

  const methods: Array<Method> = [];

  for (const { statement, createdAt } of state.wrappers) {
    const kind = kinds.find((each) => Wrapper.kindByte[each] === statement.kind);

    const endorsed =
      newest !== undefined &&
      (yield* Wrapper.verify(statement, newest).pipe(
        Effect.catchTags({
          "E2ee.Malformed": () => Effect.succeed(false),
          "E2ee.Unsupported": () => Effect.succeed(false),
        }),
      ));

    if (kind === undefined || !endorsed || unseen.has(statement.id)) continue;

    const thisDevice = Option.exists(ownDevice, (own) => sameBytes(own, statement.publicKey));

    methods.push({ kind, thisDevice, since: createdAt });
  }

  return { secured: methods.some((each) => !each.thisDevice), methods } satisfies Summary;
});

/**
 * What signing out does to the notebook, which goes with this device's key: `lost` when no other
 * way in survives the device, `unknown` while the server can't say, else `kept`. A device without
 * the key loses nothing, unless its first key waits as `pending-key` (the server may hold it). The
 * server derives a demo account's key again at every sign-in.
 */
export type AtSignOut = "kept" | "lost" | "unknown";

export const atSignOut = Effect.gen(function* () {
  if (yield* demoSignIn) return "kept" as const;

  if (Option.isNone(yield* heldRootKey)) {
    return Option.isSome(yield* heldPending) ? ("unknown" as const) : ("kept" as const);
  }

  return yield* summary.pipe(
    Effect.map(({ secured }): AtSignOut => (secured ? "kept" : "lost")),
    Effect.catchTags({ "NotebookKeys.Problem": () => Effect.succeed<AtSignOut>("unknown") }),
  );
});
