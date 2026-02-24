import { defineProject } from "vitest/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineProject({
  plugins: [
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
  ],
  test: {},
});
