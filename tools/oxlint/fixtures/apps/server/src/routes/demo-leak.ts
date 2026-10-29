// A route that reaches for what only the demo seed and persona sign-in may hold.

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: importing the seed's permission
import { seeding } from "@stu/sync/server";
import { Effect, Layer } from "effect";

declare const auth: {
  // oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: the route's view of Auth.Service
  readonly signInDemo: (accountId: string) => string;
};

declare const DemoAccounts: Record<string, string>;

declare const DemoTables: Record<string, string>;

declare const sql: (
  text: TemplateStringsArray | string,
  ...values: ReadonlyArray<string>
) => string;

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: a route that mints a demo session
export const minted = auth.signInDemo("demo-lena");

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: the same, by bracket access
export const bracketed = auth["signInDemo"];

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: a route that grants the seed's permission
export const granted = DemoAccounts.seeding;

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: granting it through a layer of its own
export const forged = Layer.succeed(DemoAccounts.Seeding, { granted: true });

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: granting it to one effect
export const provided = Effect.provideService(Effect.void, DemoAccounts.Seeding, { granted: true });

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: using the imported permission
export const imported = seeding;

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: the Drizzle table, by bracket access
export const table = DemoTables["demoAccount"];

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: a route that marks an account as demo
export const marked = sql`insert into demo_account (account_id, persona) values (${"mia"}, ${"lena"})`;

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: the table under its schema
export const qualified = sql`update public.demo_account set persona = ${"tom"}`;

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: the table's name as a plain string
export const named = sql("demo_account");

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: a merge instead of an insert
export const merged = sql`merge into demo_account using auth_user on true when not matched then do nothing`;
