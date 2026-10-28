import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infra/database/Schema.ts",
  out: "./migrations",
  // Effect's cluster migrates its own tables, and `prepare` keeps its own migration history.
  tablesFilter: ["!cluster_*", "!studienbuch_migration"],
});
