/**
 * The demo accounts: Better Auth users that the seed creates for the personas and marks in
 * `demo_account`. Creating one takes `Seeding`, which only `prepare` and the console provide, so
 * no route can turn an account into a demo account (invariant 14).
 */
import type { Demo } from "@stu/api/Demo";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as SqlClient from "effect/sql/SqlClient";
import { DemoSchool } from "./DemoSchool.ts";

export * as DemoAccounts from "./DemoAccounts.ts";

/** The permission to create demo accounts. Provide it in `prepare` and console commands only. */
export class Seeding extends Context.Service<Seeding, { readonly granted: true }>()(
  "DemoAccounts.Seeding",
) {}

export const seeding = Layer.succeed(Seeding, { granted: true });

/**
 * Sets the account's password for Better Auth's email sign-in, which keeps its hash in the
 * credential account. Hashes with Better Auth's default, as `Auth.options` configures none.
 */
const setPassword = Effect.fn("DemoAccounts.setPassword")(function* (
  account: string,
  password: string,
) {
  const sql = yield* SqlClient.SqlClient;

  const [credential] = yield* sql<{ readonly hash: string | null }>`
    select password as hash from auth_account
    where "userId" = ${account} and "providerId" = 'credential'
  `;

  const hash = credential?.hash ?? null;

  if (hash !== null && (yield* Effect.promise(() => verifyPassword({ hash, password })))) return;

  const next = yield* Effect.promise(() => hashPassword(password));

  yield* credential === undefined
    ? sql`
        insert into auth_account (id, "accountId", "providerId", "userId", password)
        values (${`${account}-credential`}, ${account}, 'credential', ${account}, ${next})
      `
    : sql`
        update auth_account set password = ${next}, "updatedAt" = now()
        where "userId" = ${account} and "providerId" = 'credential'
      `;
});

/**
 * Creates the persona's account with a confirmed address, or finds it. With `password`, the account
 * signs in with it, as the store review account on beta does. An address that another account
 * already has stops the seed, because only an account the seed made may become a demo account.
 */
export const ensure = Effect.fn("DemoAccounts.ensure")(function* (
  persona: Demo.Persona,
  password: Option.Option<Redacted.Redacted>,
) {
  yield* Seeding;
  const sql = yield* SqlClient.SqlClient;
  const { account, email } = DemoSchool.personas[persona];

  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`
        insert into auth_user (id, name, email, "emailVerified")
        values (${account}, '', ${email}, true)
        on conflict (id) do nothing
      `;

      yield* sql`
        insert into demo_account (account_id, persona) values (${account}, ${persona})
        on conflict (account_id) do nothing
      `;

      if (Option.isSome(password)) yield* setPassword(account, Redacted.value(password.value));
    }),
  );
});

/** Whether the seed made the account for a persona. */
export const isDemo = Effect.fn("DemoAccounts.isDemo")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`select 1 from demo_account where account_id = ${account}`;

  return rows.length > 0;
});

/** The persona's account, once the seed made it. */
export const accountOf = Effect.fn("DemoAccounts.accountOf")(function* (persona: Demo.Persona) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly account: string }>`
    select account_id as account from demo_account where persona = ${persona}
  `;

  return Option.fromNullishOr(row?.account);
});
