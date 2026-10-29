/**
 * The server's side of an account's keys: it stores key records, wrappers and seals after checking
 * every signature it can, and hands out seals for an unlock. It never holds a root key, a seed or a
 * PRF output, except for demo accounts, whose seed publishes generation 0 through `publishFirst`
 * like a first device does (ADR 0027).
 */
import { Keys } from "@stu/api/Keys";
import { AccountKey, CryptoSuite, Wrapper } from "@stu/e2ee";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

export * as KeyStore from "./KeyStore.ts";

const recordJson = Schema.toCodecJson(AccountKey.Record);
const statementJson = Schema.toCodecJson(Wrapper.Statement);
const sealJson = Schema.toCodecJson(Wrapper.Seal);

// Stored rows were checked on the way in, so one that doesn't decode is a defect.
const decodeRecord = (json: typeof recordJson.Encoded) =>
  Effect.orDie(Schema.decodeEffect(recordJson)(json));

const decodeStatement = (json: typeof statementJson.Encoded) =>
  Effect.orDie(Schema.decodeEffect(statementJson)(json));

const decodeSeal = (json: typeof sealJson.Encoded) =>
  Effect.orDie(Schema.decodeEffect(sealJson)(json));

const jsonText = <S extends Schema.Top>(schema: S) => {
  const encode = Schema.encodeEffect(Schema.fromJsonString(schema));

  return (value: S["Type"]) => Effect.orDie(encode(value));
};

const recordText = jsonText(recordJson);
const statementText = jsonText(statementJson);
const sealText = jsonText(sealJson);

/** Device-chosen ids follow the sync engine's rule: 1 to 64 characters. */
const isId = (id: string) => id.length >= 1 && id.length <= 64;

/** The kinds `Keys.fetchSeals` opens with. */
const methodKind = { Passkey: "prf", RecoveryCode: "code" } as const;

/** Whether two records are one generation of one account with the same keys and flag. */
const sameRecord = (a: AccountKey.Record, b: AccountKey.Record) =>
  a.format === b.format &&
  a.suite === b.suite &&
  a.accountId === b.accountId &&
  a.generation === b.generation &&
  a.reset === b.reset &&
  sameBytes(a.signingKey, b.signingKey) &&
  sameBytes(a.sealingKey, b.sealingKey);

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((byte, index) => byte === b[index]);

/** Whether `record` is a self-signed generation 0 of `account` that starts a chain. */
const isFirstRecord = Effect.fn("KeyStore.isFirstRecord")(function* (
  account: string,
  record: AccountKey.Record,
) {
  if (
    record.accountId !== account ||
    record.generation !== 0 ||
    record.reset ||
    record.link !== undefined
  ) {
    return false;
  }

  return yield* AccountKey.verify(record).pipe(
    Effect.catchTags({
      "E2ee.Malformed": () => Effect.succeed(false),
      "E2ee.Unsupported": () => Effect.succeed(false),
    }),
  );
});

/**
 * Whether a statement is one this server accepts for `account` at the generation of `newest`: its
 * fields fit its kind, it was created and endorsed at that generation, and the endorsement verifies.
 */
const isStatement = Effect.fn("KeyStore.isStatement")(function* (
  account: string,
  statement: Wrapper.Statement,
  newest: AccountKey.Record,
) {
  const fits =
    statement.accountId === account &&
    isId(statement.id) &&
    statement.anchorGeneration === newest.generation &&
    (statement.kind === Wrapper.kindByte.device
      ? statement.place === "" && statement.credentialId === "" && statement.anchor === undefined
      : statement.kind === Wrapper.kindByte.prf
        ? statement.place === "" && statement.credentialId !== "" && statement.anchor !== undefined
        : statement.kind === Wrapper.kindByte.code &&
          (statement.place === "card" || statement.place === "passwordManager") &&
          statement.credentialId === "" &&
          statement.anchor !== undefined);

  if (!fits) return false;

  return yield* Wrapper.verify(statement, newest).pipe(
    Effect.catchTags({
      "E2ee.Malformed": () => Effect.succeed(false),
      "E2ee.Unsupported": () => Effect.succeed(false),
    }),
  );
});

// A seal is an X-Wing encapsulation, and a nonce, the 32-byte root key and its tag (`Wrapper`).
const sealLength = { enc: 1120, ct: 12 + 32 + 16 };

const isSeal = (account: string, wrapper: Keys.Sealed, generation: number) =>
  wrapper.seal.format === Wrapper.format &&
  wrapper.seal.suite === CryptoSuite.id &&
  wrapper.seal.wrapperId === wrapper.statement.id &&
  wrapper.seal.accountId === account &&
  wrapper.seal.generation === generation &&
  wrapper.seal.enc.length === sealLength.enc &&
  wrapper.seal.ct.length === sealLength.ct;

/**
 * Stores a checked wrapper and its seal, with the session that added it. Sending the same wrapper
 * again changes nothing. Another statement under a taken id, or a second device wrapper from one
 * session, is `Invalid`.
 */
const insertWrapper = Effect.fn("KeyStore.insertWrapper")(function* (
  account: string,
  wrapper: Keys.Sealed,
  session: string | null,
) {
  const sql = yield* SqlClient.SqlClient;
  const { statement, seal } = wrapper;

  if (statement.kind === Wrapper.kindByte.device && session !== null) {
    const [made] = yield* sql`
      select 1 from key_wrapper
      where created_by_session = ${session} and kind = ${statement.kind} and id <> ${statement.id}
    `;

    if (made !== undefined) return yield* new Keys.Invalid({ reason: "limit" });
  }

  yield* sql`
    insert into key_wrapper (account_id, id, kind, credential_id, statement, created_by_session)
    values (${account}, ${statement.id}, ${statement.kind}, ${statement.credentialId},
      ${yield* statementText(statement)}, ${session})
    on conflict (account_id, id) do nothing
  `;

  const [stored] = yield* sql<{ readonly statement: typeof statementJson.Encoded }>`
    select statement from key_wrapper where account_id = ${account} and id = ${statement.id}
  `;

  if (stored === undefined) return yield* Effect.die("A wrapper vanished inside its transaction");

  if (!sameBytes((yield* decodeStatement(stored.statement)).publicKey, statement.publicKey)) {
    return yield* new Keys.Invalid({ reason: "id" });
  }

  yield* sql`
    insert into key_wrapper_seal (account_id, wrapper_id, generation, seal)
    values (${account}, ${statement.id}, ${seal.generation}, ${yield* sealText(seal)})
    on conflict (account_id, wrapper_id, generation) do nothing
  `;
});

/** A first device's wrapper, and the session that sends it. */
export interface First {
  readonly wrapper: Keys.Sealed;
  readonly session: string;
}

/**
 * Publishes generation 0 of an account's chain in the caller's transaction, with its first wrapper
 * when given. The same keys again change nothing (the demo seed runs on every deploy, and WebKit
 * signs with fresh randomness); other keys, or a wrapper after generation 0, are `ChainExists`.
 */
export const publishFirst = Effect.fn("KeyStore.publishFirst")(function* (
  account: string,
  record: AccountKey.Record,
  first: Option.Option<First>,
) {
  const sql = yield* SqlClient.SqlClient;

  if (!(yield* isFirstRecord(account, record))) {
    return yield* new Keys.Invalid({ reason: "record" });
  }

  if (Option.isSome(first)) {
    if (!(yield* isStatement(account, first.value.wrapper.statement, record))) {
      return yield* new Keys.Invalid({ reason: "statement" });
    }

    if (!isSeal(account, first.value.wrapper, record.generation)) {
      return yield* new Keys.Invalid({ reason: "seal" });
    }
  }

  // A concurrent first publish of the same account waits here for the other to commit.
  yield* sql`
    insert into account_key (account_id, generation, record)
    values (${account}, 0, ${yield* recordText(record)})
    on conflict (account_id, generation) do nothing
  `;

  const stored = yield* sql<{
    readonly generation: number;
    readonly record: typeof recordJson.Encoded;
  }>`
    select generation, record from account_key where account_id = ${account}
    order by generation
  `;

  const [zero] = stored;

  if (zero === undefined) return yield* Effect.die("A key record vanished inside its transaction");

  if (!sameRecord(yield* decodeRecord(zero.record), record)) return yield* new Keys.ChainExists();

  if (Option.isSome(first)) {
    // A wrapper endorsed by generation 0 after a renewal would hold a root key nobody uses.
    if (stored.length > 1) return yield* new Keys.ChainExists();

    yield* insertWrapper(account, first.value.wrapper, first.value.session);
  }
});

/** The account's key records, oldest generation first. */
const records = Effect.fn("KeyStore.records")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ readonly record: typeof recordJson.Encoded }>`
    select record from account_key where account_id = ${account} order by generation
  `;

  return yield* Effect.forEach(rows, (row) => decodeRecord(row.record));
});

/** The account's newest key record, locked until the transaction ends, so key changes queue. */
const lockNewest = Effect.fn("KeyStore.lockNewest")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly record: typeof recordJson.Encoded }>`
    select record from account_key where account_id = ${account}
    order by generation desc limit 1
    for update
  `;

  return row === undefined ? Option.none() : Option.some(yield* decodeRecord(row.record));
});

/**
 * The account's newest key record, held for share until the transaction ends, so a renewal waits
 * for a `Seal` that checks a signature against it.
 */
export const newest = Effect.fn("KeyStore.newest")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly record: typeof recordJson.Encoded }>`
    select record from account_key where account_id = ${account}
    order by generation desc limit 1
    for share
  `;

  return row === undefined ? Option.none() : Option.some(yield* decodeRecord(row.record));
});

/** What `Keys.state` answers: the chain and every wrapper's statement. */
export const state = Effect.fn("KeyStore.state")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  const wrappers = yield* sql<{
    readonly statement: typeof statementJson.Encoded;
    readonly createdAt: Date;
  }>`
    select statement, created_at as "createdAt" from key_wrapper
    where account_id = ${account} order by created_at, id
  `;

  return new Keys.State({
    records: yield* records(account),
    wrappers: yield* Effect.forEach(wrappers, (row) =>
      Effect.map(
        decodeStatement(row.statement),
        (statement) =>
          new Keys.Listed({ statement, createdAt: DateTime.fromDateUnsafe(row.createdAt) }),
      ),
    ),
  });
});

/**
 * Adds a wrapper at the newest generation. A passkey or Notfallkarte needs the session to be at
 * most `Keys.freshSignInMinutes` old, so a thief with an unlocked phone can't quietly add one.
 */
export const addWrapper = Effect.fn("KeyStore.addWrapper")(function* (
  account: string,
  session: string,
  wrapper: Keys.Sealed,
) {
  const sql = yield* SqlClient.SqlClient;
  const { statement } = wrapper;

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      if (statement.kind !== Wrapper.kindByte.device) {
        const [fresh] = yield* sql`
          select 1 from auth_session
          where id = ${session} and "userId" = ${account}
            and "createdAt" > now() - make_interval(mins => ${Keys.freshSignInMinutes})
        `;

        if (fresh === undefined) return yield* new Keys.NotFresh();
      }

      const newest = yield* lockNewest(account);

      if (Option.isNone(newest) || statement.endorsedGeneration !== newest.value.generation) {
        return yield* new Keys.Stale();
      }

      if (!(yield* isStatement(account, statement, newest.value))) {
        return yield* new Keys.Invalid({ reason: "statement" });
      }

      if (!isSeal(account, wrapper, newest.value.generation)) {
        return yield* new Keys.Invalid({ reason: "seal" });
      }

      if (statement.kind === Wrapper.kindByte.prf) {
        const [{ count } = { count: 0 }] = yield* sql<{ readonly count: number }>`
          select count(*)::int as count from key_wrapper
          where account_id = ${account} and kind = ${statement.kind}
            and credential_id = ${statement.credentialId} and id <> ${statement.id}
        `;

        if (count >= Keys.wrappersPerPasskey) return yield* new Keys.Invalid({ reason: "limit" });
      }

      yield* insertWrapper(account, wrapper, session);
    }),
  );
});

/**
 * The seals of the newest generation for one unlock method, with the whole chain to check them
 * against. A fetch that finds a seal writes a `recovery_event` in the same transaction, and the
 * account gets `Keys.fetchesPerDay` of those in 24 hours.
 */
export const fetchSeals = Effect.fn("KeyStore.fetchSeals")(function* (
  account: string,
  method: Keys.Method,
) {
  const sql = yield* SqlClient.SqlClient;
  const kind = methodKind[method._tag];
  const credential = method._tag === "Passkey" ? method.credentialId : "";

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      const newest = yield* lockNewest(account);

      if (Option.isNone(newest)) return new Keys.Seals({ records: [], wrappers: [] });

      const [{ count } = { count: 0 }] = yield* sql<{ readonly count: number }>`
        select count(*)::int as count from recovery_event
        where account_id = ${account} and kind = 'sealsFetched'
          and at > now() - interval '24 hours'
      `;

      if (count >= Keys.fetchesPerDay) return yield* new Keys.TooManyAttempts();

      const rows = yield* sql<{
        readonly statement: typeof statementJson.Encoded;
        readonly seal: typeof sealJson.Encoded;
      }>`
        select w.statement, s.seal
        from key_wrapper w
        join key_wrapper_seal s on s.account_id = w.account_id and s.wrapper_id = w.id
          and s.generation = ${newest.value.generation}
        where w.account_id = ${account} and w.kind = ${Wrapper.kindByte[kind]}
          and w.credential_id = ${credential}
        order by w.created_at, w.id
      `;

      if (rows.length > 0) {
        yield* sql`
          insert into recovery_event (account_id, kind, method, credential_id)
          values (${account}, 'sealsFetched', ${kind}, ${kind === "prf" ? credential : null})
        `;
      }

      return new Keys.Seals({
        records: yield* records(account),
        wrappers: yield* Effect.forEach(rows, (row) =>
          Effect.gen(function* () {
            return new Keys.Sealed({
              statement: yield* decodeStatement(row.statement),
              seal: yield* decodeSeal(row.seal),
            });
          }),
        ),
      });
    }),
  );
});
