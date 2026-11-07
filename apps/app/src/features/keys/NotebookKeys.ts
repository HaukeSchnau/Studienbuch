import { Keys } from "@stu/api/Keys";
import { AccountKey, CryptoSuite, type E2ee, RecoveryCode, Wrapper } from "@stu/e2ee";
import { Ids } from "@stu/sync";
import { Ports, SyncClient } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Device } from "../../infra/device/Device.ts";
import { KeyServer } from "./KeyServer.ts";

// The notebook's root key on this device (recovery.md, sections 1 and 2): the first device makes
// it, a new device unlocks with a passkey's PRF output or a Notfallkarte, and "Notizbuch-
// Schlüssel" adds methods. The device accepts a key only after `Wrapper.recover` checked the
// anchor, every chain link and the newest generation's endorsement, so the server can't plant one.

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
 * The keys of the newest record, if this device's root key derives them. A device whose key the
 * newest generation doesn't match never writes under it.
 */
const ownKeys = Effect.fn("NotebookKeys.ownKeys")(function* (
  rootKey: Redacted.Redacted<Uint8Array>,
  records: ReadonlyArray<AccountKey.Record>,
) {
  const newest = records.at(-1);

  if (newest === undefined) return Option.none<AccountKey.Keys>();

  const keys = yield* Effect.orDie(AccountKey.derive(rootKey, newest.accountId, newest.generation));

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
 * or a restore, and answers whether the account's key chain is this device's. It publishes only the
 * device's own record and never adopts another chain. M1 has generation 0 only.
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
        "Keys.Invalid": Effect.die,
      }),
    );
  }

  const keys = yield* ownKeys(rootKey.value, state.records);

  if (Option.isNone(keys)) return false;

  if (Option.isNone(seed)) return true;
  const own = yield* Effect.orDie(Wrapper.derive("device", seed.value, keys.value.accountId));

  const listed = state.wrappers.some(
    ({ statement }) =>
      statement.kind === Wrapper.kindByte.device && sameBytes(statement.publicKey, own.publicKey),
  );

  if (listed) return true;

  yield* server.addWrapper(yield* wrap("device", seed.value, keys.value)).pipe(
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
 * The first device of an account makes the root key and its own device wrapper, and keeps them
 * as `pending-key` until the server took them, so a lost answer sends the same record and wrapper
 * again. Another device that got there first wins, and this one is then locked like any new one.
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

/**
 * Where this device stands. A device without a key asks the server, and the first device of an
 * account starts the notebook's key right away.
 */
export const status = Effect.gen(function* () {
  if (Option.isSome(yield* heldRootKey)) return Status.Unlocked();

  const offline = () => Effect.succeed(Status.Offline());

  const records = yield* (yield* KeyServer.Service).state.pipe(
    Effect.map((state) => Option.some(state.records)),
    Effect.catchTags({
      "KeyServer.Unreachable": () => Effect.succeedNone,
      "Keys.SignedOut": () => Effect.succeedNone,
    }),
  );

  if (Option.isNone(records)) return Status.Offline();

  // A first device whose init answer was lost finds its own record there, and sends it again.
  if (records.value.length > 0 && Option.isNone(yield* heldPending)) return Status.Locked();

  if (records.value.length === 0 && (yield* Device.Service).publicComputer) {
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
  if (!(yield* Device.Service).publicComputer && Option.isNone(yield* heldSeed)) {
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

/** "Mit der Notfallkarte": the code as typed. A typo stops before anything leaves the device. */
export const unlockWithCode = Effect.fn("NotebookKeys.unlockWithCode")(function* (typed: string) {
  const parsed = RecoveryCode.parse(typed);

  if (Result.isFailure(parsed)) {
    return yield* problem(parsed.failure.reason === "length" ? "length" : "typo");
  }

  yield* recoverWith("code", parsed.success, Keys.RecoveryCode.make({}));
});

const add = (wrapper: Keys.Sealed) =>
  Effect.flatMap(KeyServer.Service, (server) => server.addWrapper(wrapper)).pipe(
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

/** A new Notfallkarte: its code's text, shown once, and its wrapper for the server. */
export interface Card {
  readonly text: Redacted.Redacted;
  readonly wrapper: Keys.Sealed;
}

/** "Notfallkarte erstellen": a new code and its wrapper, in memory only. */
export const newRecoveryCode = Effect.gen(function* () {
  const { keys } = yield* current;
  const code = yield* RecoveryCode.generate;

  return {
    text: code.text,
    wrapper: yield* wrap("code", code.bytes, keys, { place: "card" }),
  } satisfies Card;
});

/**
 * Sends a card's wrapper and answers its text, which the screen shows once. After a lost answer
 * the same card goes out again, so the code shown is the one the server holds.
 */
export const sendRecoveryCode = Effect.fn("NotebookKeys.sendRecoveryCode")(function* (card: Card) {
  yield* add(card.wrapper);

  return card.text;
});

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
 * and a card whose code the student hasn't seen yet (`unseen`, wrapper ids) doesn't count either.
 */
export const summary = Effect.fn("NotebookKeys.summary")(function* (
  unseen: ReadonlySet<string> = new Set(),
) {
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
