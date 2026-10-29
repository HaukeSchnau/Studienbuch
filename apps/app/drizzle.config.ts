import { defineConfig } from "drizzle-kit";

// The device migrations. `driver: "expo"` also writes `migrations.js`, which imports each
// migration's SQL as text; Metro inlines it (metro.config.js).
export default defineConfig({
  dialect: "sqlite",
  driver: "expo",
  schema: "./src/infra/sqlite/Schema.ts",
  out: "./src/infra/sqlite/migrations",
});
