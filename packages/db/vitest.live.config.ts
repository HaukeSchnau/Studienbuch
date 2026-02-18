import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.live.integration.test.ts"],
    fileParallelism: false,
    globalSetup: ["./testing/global-setup.ts"],
    setupFiles: ["./testing/setup.ts"],
    hookTimeout: 120_000,
    testTimeout: 120_000,
  },
});
