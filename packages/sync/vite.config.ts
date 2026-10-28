import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    // drizzle-kit's `migrations.js` imports each migration's SQL as text, as Metro's inline import
    // does on the device.
    {
      name: "sql-as-text",
      transform: (code, id) =>
        id.endsWith(".sql") ? { code: `export default ${JSON.stringify(code)};`, map: null } : null,
    },
  ],
  test: {
    globalSetup: ["./src/testing/Postgres18.setup.ts"],
    // PGlite takes several seconds to start, and the property tests run hundreds of cases on four
    // engines.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
