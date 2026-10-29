import { defineConfig } from "vite-plus";

export default defineConfig({
  // The release runs `dist/` on the host's own Node 26 without node_modules, so every dependency is
  // bundled. None of them may be a native addon (ADR 0005).
  pack: {
    entry: { main: "src/main.ts" },
    platform: "node",
    target: "node26",
    format: "esm",
    outDir: "dist",
    dts: false,
    sourcemap: true,
    deps: { alwaysBundle: [/.*/], onlyBundle: false },
  },
  test: {
    // A throwaway PostgreSQL 18 for the tests that need one (`Postgres18` in @stu/sync/testing).
    globalSetup: ["@stu/sync/testing/postgres18.setup"],
    // Many tests start a database-backed server, which takes seconds on a loaded host.
    testTimeout: 30_000,
  },
});
