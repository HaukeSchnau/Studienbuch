/**
 * The device's keys. The account's root key is the 32 bytes `DeviceSecrets` holds as `root-key`,
 * of the generation in `sync_meta.key_generation`, and the space keys the device opened from key
 * boxes live in `sync_space_key`. The engine opens and seals rows and boxes through it.
 */
import { AccountKey, CryptoSuite, SealedRow, SpaceKey, Wrapper } from "@stu/e2ee";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Ports } from "./Ports.ts";

export * as Keyring from "./Keyring.ts";

/** The account's keys of one generation, with the record they sign boxes and check them by. */
export interface Account {
  readonly keys: AccountKey.Keys;
  readonly record: AccountKey.Record;
}

/** The device's own seal of the account's newest root key, and the account's key records. */
export interface OwnSeal {
  readonly seal: Wrapper.Seal;
  readonly records: ReadonlyArray<AccountKey.Record>;
}

export interface Opened {
  readonly table: string;
  readonly json: string;
}

const decodeBox = Schema.decodeUnknownEffect(Schema.toCodecJson(SpaceKey.KeyBox));
const decodeEnvelope = Schema.decodeUnknownEffect(Schema.toCodecJson(SealedRow.Envelope));

const rootKeyLength = 32;

/** The formats this build opens rows and boxes in. A start under other ones opens what waited. */
export const opens = `row ${SealedRow.format}, box ${SpaceKey.format}, suite ${CryptoSuite.id}`;

/** The key of `space` at `epoch`, if the device opened it. */
export const spaceKey = Effect.fnUntraced(function* (space: string, epoch: number) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly key: Uint8Array }>`
    select key from sync_space_key where space = ${space} and key_epoch = ${epoch}
  `;

  return Option.map(Option.fromNullishOr(row), (each) => Redacted.make(new Uint8Array(each.key)));
});

/** Keeps epoch keys a box delivered. They replace a key the device made itself. */
export const storeKeys = Effect.fnUntraced(function* (
  space: string,
  keys: ReadonlyArray<SpaceKey.EpochKey>,
) {
  const sql = yield* SqlClient.SqlClient;

  for (const { epoch, key } of keys) {
    yield* sql`
      insert into sync_space_key (space, key_epoch, key, made_here)
      values (${space}, ${epoch}, ${Redacted.value(key)}, 0)
      on conflict (space, key_epoch) do update set key = excluded.key, made_here = 0
    `;
  }
});

/**
 * Keeps the epoch-0 key the device made for a space nobody opened yet, before a command boxes it.
 * It counts only until the server lists the space's epoch: then the server's box carries the key.
 */
export const keepOwn = Effect.fnUntraced(function* (
  space: string,
  key: Redacted.Redacted<Uint8Array>,
) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    insert into sync_space_key (space, key_epoch, key, made_here)
    values (${space}, 0, ${Redacted.value(key)}, 1)
    on conflict (space, key_epoch) do nothing
  `;
});

/**
 * Drops the keys the device made for spaces whose epoch the server now lists. Another device may
 * have opened that epoch first, and a row sealed under a key nobody else holds would be lost.
 */
export const dropOwnOnceListed = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    delete from sync_space_key where made_here = 1
      and space in (select id from sync_space where key_epoch is not null)
  `;
});

export const make = Effect.fnUntraced(function* (actor: string) {
  const secrets = yield* Ports.DeviceSecrets;
  let cached: Option.Option<Account> | undefined;

  const generation = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const [row] = yield* sql<{ readonly key_generation: number }>`
      select key_generation from sync_meta where id = 1
    `;

    return row?.key_generation ?? 0;
  });

  // A 32-byte key derives for any account id the server accepted, so a failure is a defect.
  const derive = Effect.fnUntraced(function* (rootKey: Uint8Array, at: number) {
    const keys = yield* AccountKey.derive(Redacted.make(rootKey), actor, at);

    return { keys, record: yield* AccountKey.record(keys, "first") } satisfies Account;
  }, Effect.orDie);

  /** The account's keys, or `None` while the device holds no root key ("Notizbuch entsperren"). */
  const account = Effect.gen(function* () {
    if (cached !== undefined) return cached;

    const rootKey = yield* secrets
      .get("root-key")
      .pipe(Effect.catchTags({ "DeviceSecrets.SecretsUnavailable": () => Effect.succeedNone }));

    if (Option.isNone(rootKey) || rootKey.value.length !== rootKeyLength) {
      return Option.none<Account>();
    }

    cached = Option.some(yield* derive(rootKey.value, yield* generation));

    return cached;
  });

  /** Keeps a root key the device just got, as after unlocking or a demo sign-in. */
  const unlock = Effect.fnUntraced(function* (rootKey: Uint8Array, at: number) {
    const sql = yield* SqlClient.SqlClient;
    yield* secrets.set("root-key", rootKey);
    yield* sql`update sync_meta set key_generation = ${at} where id = 1`;
    cached = Option.some(yield* derive(rootKey, at));
  });

  /**
   * The keys of a renewed root key from the device's own seal, if the records chain from the
   * generation the device holds to the seal's and the seal opens with the device's seed.
   */
  const renewed = Effect.fnUntraced(function* (fetched: OwnSeal) {
    const own = yield* account;

    const seed = yield* secrets
      .get("device-seed")
      .pipe(Effect.catchTags({ "DeviceSecrets.SecretsUnavailable": () => Effect.succeedNone }));

    if (Option.isNone(own) || Option.isNone(seed)) return Option.none<AccountKey.Keys>();

    const refused = (reason: string) =>
      Effect.as(Effect.logWarning("The device's own seal doesn't open", { reason }), Option.none());

    return yield* Wrapper.renewed(
      Redacted.make(seed.value),
      fetched.seal.wrapperId,
      own.value.record,
      fetched.seal,
      fetched.records,
    ).pipe(
      Effect.asSome,
      Effect.catchTags({
        "E2ee.Malformed": (error) => refused(error._tag),
        "E2ee.Unsupported": (error) => refused(error._tag),
        "E2ee.Untrusted": (error) => refused(error._tag),
        "E2ee.WrongSecret": (error) => refused(error._tag),
      }),
    );
  });

  /** Forgets the cached keys, after a wipe removed the root key. */
  const forget = Effect.sync(() => {
    cached = undefined;
  });

  /**
   * The keys in a box of `space`, if it is for this account and signed by it. M1's notebooks have
   * one member, so a box from another author waits until key records of other accounts arrive.
   */
  const openBox = Effect.fnUntraced(function* (space: string, data: Schema.Json) {
    const none: ReadonlyArray<SpaceKey.EpochKey> = [];
    const box = yield* Effect.option(decodeBox(data));
    const own = yield* account;

    if (Option.isNone(box) || Option.isNone(own) || box.value.recipient !== actor) return none;

    if (box.value.author !== actor) return none;

    return yield* SpaceKey.openBox(box.value, space, own.value.keys, own.value.record).pipe(
      Effect.catchTags({
        "E2ee.Malformed": () => Effect.succeed(none),
        "E2ee.Unsupported": () => Effect.succeed(none),
        "E2ee.Untrusted": () => Effect.succeed(none),
        "E2ee.WrongSecret": () => Effect.succeed(none),
      }),
    );
  });

  /**
   * Opens a sealed row, or `None` to park it: its key is missing, its format or suite is newer
   * than this build, or it doesn't open.
   */
  const openRow = Effect.fnUntraced(function* (
    space: string,
    id: string,
    envelope: Schema.Json,
    ct: Uint8Array,
  ) {
    const decoded = yield* Effect.option(decodeEnvelope(envelope));

    if (Option.isNone(decoded)) return Option.none<Opened>();
    const key = yield* spaceKey(space, decoded.value.keyEpoch);

    if (Option.isNone(key)) return Option.none<Opened>();

    return yield* SealedRow.open({ space, id }, decoded.value, ct, key.value).pipe(
      Effect.asSome,
      Effect.catchTags({
        "E2ee.Unsupported": () => Effect.succeedNone,
        "E2ee.WrongSecret": () =>
          Effect.as(Effect.logWarning("A sealed row doesn't open", { space, id }), Option.none()),
        "E2ee.Malformed": () =>
          Effect.as(Effect.logWarning("A sealed row is malformed", { space, id }), Option.none()),
      }),
    );
  });

  return { account, unlock, renewed, forget, openBox, openRow };
});

export type Keyring = Effect.Success<ReturnType<typeof make>>;
