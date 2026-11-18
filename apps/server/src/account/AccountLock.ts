/**
 * An account's lock, in one order for every path that writes its rows: 1. its logins
 * (`auth_account`), for update if the path changes or deletes one, else for share; 2. its user row;
 * 3. its newest key record. Each mode is the strongest the path will need, taken up front: a lock
 * upgraded later, or one taken out of order, would deadlock with another path.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

export * as AccountLock from "./AccountLock.ts";

/** For share, or for update when the path will change or delete what it locks. */
export type Mode = "share" | "update";

const logins = Effect.fn("AccountLock.logins")(function* (account: string, mode: Mode) {
  const sql = yield* SqlClient.SqlClient;

  yield* mode === "update"
    ? sql`select 1 from auth_account where "userId" = ${account} order by id for update`
    : sql`select 1 from auth_account where "userId" = ${account} order by id for share`;
});

/**
 * Steps 1 and 2 for a path that adds rows for the account, its logins in `mode`: a deletion under
 * way waits for it, and one that came first leaves the account gone, which answers false. A card
 * sign-in holds its login while Better Auth's own pool adds the session, which needs the user row,
 * so this order also lets a sign-in under way finish before a deletion goes on.
 */
export const hold = Effect.fn("AccountLock.hold")(function* (account: string, mode: Mode) {
  const sql = yield* SqlClient.SqlClient;

  yield* logins(account, mode);
  const [user] = yield* sql`select 1 from auth_user where id = ${account} for share`;

  return user !== undefined;
});

/** Steps 1 and 2 for update, for the account's deletion. Answers its address, or none once gone. */
export const take = Effect.fn("AccountLock.take")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* logins(account, "update");

  const [user] = yield* sql<{ readonly email: string }>`
    select email from auth_user where id = ${account} for update
  `;

  return Option.map(Option.fromNullishOr(user), ({ email }) => email);
});

/**
 * Step 3: the account's newest key record as stored, after `hold`, for update to change keys or
 * count an unlock, for share to check a signature. None before the first.
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
