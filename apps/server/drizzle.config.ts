import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  // The sync engine's tables live with the engine, and their migrations with the app's.
  schema: [
    "./src/infra/database/Schema.ts",
    "./src/auth/AuthTables.ts",
    "./src/infra/mail/MailTables.ts",
    "../../packages/sync/src/server/Tables.ts",
  ],
  out: "./migrations",
  // Effect's cluster migrates its own tables, and `prepare` keeps its own migration history.
  tablesFilter: ["!cluster_*", "!studienbuch_migration"],
});
