import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      ignoreEmptyLines: true,
      include: ["**/src/**/*"],
      skipFull: true,
      exclude: [
        "**/__mocks__/**/*",
        "**/generated/**/*",
        "**/.next/**/*",
        "**/dist/**/*",
        "**/*.test.ts",
      ],
    },
  },
});
