// A route that reaches for what only the demo seed and persona sign-in may hold.

declare const auth: {
  // oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: the route's view of Auth.Service
  readonly signInDemo: (accountId: string) => string;
};

declare const DemoAccounts: { readonly seeding: string };

declare const sql: (strings: TemplateStringsArray, ...values: ReadonlyArray<string>) => string;

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: a route that mints a demo session
export const minted = auth.signInDemo("demo-lena");

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: a route that grants the seed's permission
export const granted = DemoAccounts.seeding;

// oxlint-disable-next-line studienbuch/demo-account-boundaries -- fixture: a route that marks an account as demo
export const marked = sql`insert into demo_account (account_id, persona) values (${"mia"}, ${"lena"})`;

export const read = sql`select persona from demo_account where account_id = ${"mia"}`;
