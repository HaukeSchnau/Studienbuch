import { defineConfig } from "drizzle-kit";

// The device migrations for the conformance tests' probe table. An app points the same config at
// its own schema file.
export default defineConfig({
  dialect: "sqlite",
  // Also writes `migrations.js`, which imports each migration's SQL as text: the record
  // `DeviceDatabase.migrate` takes, bundled by Metro on the device and by Vite in tests.
  driver: "expo",
  schema: "./src/conformance/ProbeDevice.ts",
  out: "./src/conformance/migrations",
});
