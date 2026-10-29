/**
 * The demo accounts: Better Auth users that the seed creates for the personas and marks in
 * `demo_account`. Creating one takes `Seeding`, which only `prepare` and the console provide, so
 * no route can turn an account into a demo account (invariant 14).
 */
import type { Demo } from "@stu/api/Demo";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { DemoSchool } from "./DemoSchool.ts";

export * as DemoAccounts from "./DemoAccounts.ts";

/**
 * The permission to create demo accounts. Only `prepare` and the console in `main.ts` provide it,
 * which the lint rule `studienbuch/demo-account-boundaries` enforces.
 */
export class Seeding extends Context.Service<Seeding, { readonly granted: true }>()(
  "DemoAccounts.Seeding",
) {}

export const seeding = Layer.succeed(Seeding, { granted: true });

/**
 * The seed hashes the password itself, past Better Auth's own minimum, so this is its only check:
 * at least 16 characters, without blanks around them. An empty secret file fails `prepare`.
 */
const Password = Schema.String.check(Schema.isTrimmed(), Schema.isMinLength(16));

/** `DEMO_PASSWORD`, which the personas sign in with on beta. Absent on development and previews. */
export const password = Config.option(Config.schema(Schema.Redacted(Password), "DEMO_PASSWORD"));

/**
 * Ends every way into the account but its password: its sessions and passkeys. Changing or removing
 * the demo password then locks out whoever learned the old one. Open sync connections close at
 * their next session check.
 */
const signOutEverywhere = Effect.fn("DemoAccounts.signOutEverywhere")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`delete from auth_session where "userId" = ${account}`;
  yield* sql`delete from auth_passkey where "userId" = ${account}`;
});

/**
 * Makes the account sign in with `password` through Better Auth's email sign-in, which keeps the
 * hash in the credential account, or with no password at all. Hashes with Better Auth's default,
 * as `Auth.options` configures none.
 */
const setPassword = Effect.fn("DemoAccounts.setPassword")(function* (
  account: string,
  password: Option.Option<string>,
) {
  const sql = yield* SqlClient.SqlClient;

  const [credential] = yield* sql<{ readonly hash: string | null }>`
    select password as hash from auth_account
    where "userId" = ${account} and "providerId" = 'credential'
  `;

  if (Option.isNone(password)) {
    if (credential === undefined) return;

    yield* sql`
      delete from auth_account where "userId" = ${account} and "providerId" = 'credential'
    `;

    return yield* signOutEverywhere(account);
  }

  const hash = credential?.hash ?? null;
  const next = password.value;

  if (hash !== null && (yield* Effect.promise(() => verifyPassword({ hash, password: next })))) {
    return;
  }

  const hashed = yield* Effect.promise(() => hashPassword(next));

  if (credential === undefined) {
    yield* sql`
      insert into auth_account (id, "accountId", "providerId", "userId", password)
      values (${`${account}-credential`}, ${account}, 'credential', ${account}, ${hashed})
    `;

    return;
  }

  yield* sql`
    update auth_account set password = ${hashed}, "updatedAt" = now()
    where "userId" = ${account} and "providerId" = 'credential'
  `;

  yield* signOutEverywhere(account);
});

/**
 * Creates the persona's account with a confirmed address, or finds it. With `password`, the account
 * signs in with it, as the store review account on beta does, and without, it has none. An address
 * that another account already has stops the seed, because only an account the seed made may
 * become a demo account.
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

      yield* setPassword(account, Option.map(password, Redacted.value));
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
