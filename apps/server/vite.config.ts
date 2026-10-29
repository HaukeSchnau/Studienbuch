import { defineConfig } from "vite-plus";

// Dependencies that load these only inside a try block and carry on without them: pg's native
// binding, which nothing here enables, and Better Auth's OpenTelemetry tracer. They resolve to a
// module that fails to load as a missing package does, so the bundle holds every import it has.
const optionalPackages = new Set(["pg-native", "@opentelemetry/api"]);
const missingPackage = "\0missing-package:";

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
    plugins: [
      {
        name: "studienbuch:optional-packages",
        resolveId: (source: string) =>
          optionalPackages.has(source) ? `${missingPackage}${source}` : null,
        load: (id: string) =>
          id.startsWith(missingPackage)
            ? `const error = new Error("Cannot find module '${id.slice(missingPackage.length)}'");
error.code = "MODULE_NOT_FOUND";
throw error;`
            : null,
      },
    ],
  },
  test: {
    // A throwaway PostgreSQL 18 for the tests that need one (`Postgres18` in @stu/sync/testing).
    globalSetup: ["@stu/sync/testing/postgres18.setup"],
    // Many tests start a database-backed server, which takes seconds on a loaded host.
    testTimeout: 30_000,
  },
});
