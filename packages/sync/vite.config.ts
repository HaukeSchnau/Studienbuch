import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    // drizzle-kit's `migrations.js` imports each migration's SQL as text, and `Replay` the
    // conformance fixture, as the app's Metro transformer does on the device.
    {
      name: "text-files",
      transform: (code, id) =>
        /\.(?:sql|jsonl)$/u.test(id)
          ? { code: `export default ${JSON.stringify(code)};`, map: null }
          : null,
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
