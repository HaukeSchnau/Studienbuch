import "vite-plus/test/config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    name: "@stu/server",
    env: {
      // Better Auth reads its signing secret from the environment. Setting it here keeps the
      // integration test self-sufficient instead of depending on the caller's shell.
      BETTER_AUTH_SECRET: "integration-test-secret-at-least-32-characters",
    },
  },
});
