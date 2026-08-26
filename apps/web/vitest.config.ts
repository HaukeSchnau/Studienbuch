import { defineConfig } from "vite-plus";

/**
 * Server code and browser code are tested in the environments they actually run in. `*.server.*`
 * modules reach for `@stu/server`, `pg`, and Node builtins, which jsdom cannot resolve; everything
 * else may touch the DOM.
 */
export default defineConfig({
  test: {
    // CI runs application, package, integration, lint, and mobile checks concurrently. Bounding
    // this pool keeps fork startup responsive on the shared ARM runner without serializing the
    // otherwise independent browser and server projects.
    maxWorkers: 2,
    projects: [
      {
        test: {
          name: "@stu/web/server",
          environment: "node",
          include: ["src/**/*.server.test.ts"],
        },
      },
      {
        test: {
          name: "@stu/web/browser",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.server.test.ts"],
        },
      },
    ],
  },
});
