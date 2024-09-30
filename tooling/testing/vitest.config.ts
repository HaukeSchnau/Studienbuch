import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    deps: {
      moduleDirectories: ["node_modules", "packages"],
    },
    setupFiles: ["./database/setup.ts"],
    globalSetup: ["./database/global-setup.ts"],
  },
});
