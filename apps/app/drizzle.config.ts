import { defineConfig } from "drizzle-kit";

// The device migrations. `driver: "expo"` also writes `migrations.js`, which imports each
// migration's SQL as text; Metro inlines it (metro.config.js). The engine's own tables come from
// the sync package.
export default defineConfig({
  dialect: "sqlite",
  driver: "expo",
  schema: ["./src/infra/sqlite/Schema.ts", "../../packages/sync/src/client/EngineTables.ts"],
  out: "./src/infra/sqlite/migrations",
});
