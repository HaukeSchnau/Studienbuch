import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    deps: {
      moduleDirectories: ["node_modules", "packages"],
    },
    setupFiles: ["../../packages/db/testing/setup.ts"],
    globalSetup: ["../../packages/db/testing/global-setup.ts"],
  },
});
