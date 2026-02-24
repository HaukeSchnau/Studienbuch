import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.ts", "tooling/*/vitest.config.ts"],
    coverage: {
      include: ["**/src/**/*"],
      skipFull: true,
      exclude: ["**/__mocks__/**/*", "**/generated/**/*", "**/.next/**/*", "**/dist/**/*", "**/*.test.ts"],
    },
  },
});
