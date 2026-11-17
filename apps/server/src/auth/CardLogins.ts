/**
 * The Notfallkarte's sign-in for an account without an address (pseudonymous-accounts.md, 4.3). A
 * card login is a Better Auth account row, so deleting the account deletes it, and its `accountId`
 * is the SHA-256 of the login the device derives from the card. The login carries the card's 128
 * bits, so a dump can't be searched for it, and the server can't derive the card from it.
 */
import { Accounts } from "@stu/api/Accounts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Hex from "effect/encoding/Hex";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";

export * as CardLogins from "./CardLogins.ts";

/** The `providerId` of a card login. */
export const provider = "recovery-code";

/** The `accountId` a login is stored under: the hex SHA-256 of its 32 bytes. */
export const digest = Effect.fn("CardLogins.digest")(function* (login: string) {
  const crypto = yield* Crypto.Crypto;
  // `Accounts.Login` checked the text, so it decodes. A login that didn't must never share a row.
  const bytes = yield* Effect.orDie(Effect.fromResult(Base64Url.decode(login)));

  return Hex.encode(yield* Effect.orDie(crypto.digest("SHA-256", bytes)));
});

/** The account whose card the login is from. */
export const owner = Effect.fn("CardLogins.owner")(function* (login: string) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly userId: string }>`
    select "userId" from auth_account
    where "providerId" = ${provider} and "accountId" = ${yield* digest(login)}
  `;

  return Option.map(Option.fromNullishOr(row), ({ userId }) => userId);
});

/** Whether the account has an email address, rather than a placeholder for none. */
export const hasAddress = Effect.fn("CardLogins.hasAddress")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{
    readonly email: string;
  }>`select email from auth_user where id = ${account}`;

  return row !== undefined && !Accounts.isPlaceholder(row.email);
});

/**
 * Makes the login the account's only card login, in the caller's transaction. Answers false, and
 * changes nothing, when the login is another account's.
 */
export const replace = Effect.fn("CardLogins.replace")(function* (account: string, login: string) {
  const sql = yield* SqlClient.SqlClient;
  const accountId = yield* digest(login);

  yield* sql`
    insert into auth_account (id, "accountId", "providerId", "userId")
    values (${Hex.encode(yield* Effect.orDie((yield* Crypto.Crypto).randomBytes(16)))},
      ${accountId}, ${provider}, ${account})
    on conflict ("providerId", "accountId") do nothing
  `;

  const [row] = yield* sql<{ readonly userId: string }>`
    select "userId" from auth_account where "providerId" = ${provider} and "accountId" = ${accountId}
  `;

  if (row?.userId !== account) return false;

  yield* sql`
    delete from auth_account
    where "userId" = ${account} and "providerId" = ${provider} and "accountId" <> ${accountId}
  `;

  return true;
});
