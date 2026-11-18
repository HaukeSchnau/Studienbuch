/**
 * An account's lock, logins (`auth_account`) before the user row. A card sign-in holds its login
 * while Better Auth's own pool adds the session, which needs the user row: locking the user row
 * first would deadlock with it where Postgres can't see the cycle.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";

export * as AccountLock from "./AccountLock.ts";

/**
 * Holds the account for share until the transaction ends, as every write that adds rows for it
 * does first: a deletion under way waits for the write, and one that came first leaves nothing to
 * hold. False once the account is gone.
 */
export const hold = Effect.fn("AccountLock.hold")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`select 1 from auth_account where "userId" = ${account} order by id for share`;
  const [user] = yield* sql`select 1 from auth_user where id = ${account} for share`;

  return user !== undefined;
});

/** Locks the account for its deletion, and answers its address, or none once it's gone. */
export const take = Effect.fn("AccountLock.take")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`select 1 from auth_account where "userId" = ${account} order by id for update`;

  const [user] = yield* sql<{ readonly email: string }>`
    select email from auth_user where id = ${account} for update
  `;

  return Option.map(Option.fromNullishOr(user), ({ email }) => email);
});
