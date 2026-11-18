/**
 * An account's lock, taken first by every path that writes its rows: an advisory lock on its id,
 * shared, or exclusive to delete the account, replace a login or admit it to a school, so Better
 * Auth's own pool joins no cycle. Row locks follow in one order: logins, user row, newest key.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

export * as AccountLock from "./AccountLock.ts";

/**
 * Shared, or exclusive for a path that deletes the account, changes or deletes a login, or admits
 * it to a school, since admissions of one account run one at a time.
 */
export type Mode = "share" | "update";

/**
 * The advisory lock, until the transaction ends. Its key is a 64-bit hash of the account's id, so
 * a collision only makes two accounts wait for each other.
 */
const advisory = Effect.fn("AccountLock.advisory")(function* (account: string, mode: Mode) {
  const sql = yield* SqlClient.SqlClient;
  const key = `studienbuch.account:${account}`;

  yield* mode === "update"
    ? sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`
    : sql`select pg_advisory_xact_lock_shared(hashtextextended(${key}, 0))`;
});

const logins = Effect.fn("AccountLock.logins")(function* (account: string, mode: Mode) {
  const sql = yield* SqlClient.SqlClient;

  yield* mode === "update"
    ? sql`select 1 from auth_account where "userId" = ${account} order by id for update`
    : sql`select 1 from auth_account where "userId" = ${account} order by id for share`;
});

/**
 * Holds the account for a path that adds rows for it, in `mode`, and answers false once the
 * account is gone: a deletion under way waits for the path, and one that came first leaves
 * nothing to hold.
 */
export const hold = Effect.fn("AccountLock.hold")(function* (account: string, mode: Mode) {
  const sql = yield* SqlClient.SqlClient;

  yield* advisory(account, mode);
  yield* logins(account, mode);
  const [user] = yield* sql`select 1 from auth_user where id = ${account} for share`;

  return user !== undefined;
});

/** Locks the account for its deletion, and answers its address, or none once it's gone. */
export const take = Effect.fn("AccountLock.take")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* advisory(account, "update");
  yield* logins(account, "update");

  const [user] = yield* sql<{ readonly email: string }>`
    select email from auth_user where id = ${account} for update
  `;

  return Option.map(Option.fromNullishOr(user), ({ email }) => email);
});

/**
 * The account's newest key record as stored, after `hold`: for update to change keys or count an
 * unlock, for share to check a signature. None before the first.
 */
export const newestKey = Effect.fn("AccountLock.newestKey")(function* (
  account: string,
  mode: Mode,
) {
  const sql = yield* SqlClient.SqlClient;

  const rows =
    mode === "update"
      ? yield* sql<{ readonly record: Schema.Json }>`
          select record from account_key where account_id = ${account}
          order by generation desc limit 1
          for update
        `
      : yield* sql<{ readonly record: Schema.Json }>`
          select record from account_key where account_id = ${account}
          order by generation desc limit 1
          for share
        `;

  return Option.map(Option.fromNullishOr(rows[0]), ({ record }) => record);
});

/**
 * The account a card login belongs to, held for share (`hold`), with its login held too, so a
 * replacement or a deletion waits until the caller's transaction ends. None for a login that
 * belongs to nobody, or that a replacement retired while this waited.
 */
export const holdLoginOwner = Effect.fn("AccountLock.holdLoginOwner")(function* (
  provider: string,
  accountId: string,
) {
  const sql = yield* SqlClient.SqlClient;

  const owner = (lock: boolean) =>
    Effect.map(
      lock
        ? sql<{ readonly userId: string }>`
            select "userId" from auth_account
            where "providerId" = ${provider} and "accountId" = ${accountId}
            for share
          `
        : sql<{ readonly userId: string }>`
            select "userId" from auth_account
            where "providerId" = ${provider} and "accountId" = ${accountId}
          `,
      ([row]) => Option.map(Option.fromNullishOr(row), ({ userId }) => userId),
    );

  // The account isn't known before the login is read, so the lock comes after a first read, and a
  // second read under it checks that the login still belongs to that account.
  const seen = yield* owner(false);

  if (Option.isNone(seen) || !(yield* hold(seen.value, "share"))) return Option.none<string>();

  return Option.filter(yield* owner(true), (account) => account === seen.value);
});
