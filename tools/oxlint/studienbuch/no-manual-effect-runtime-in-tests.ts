import { defineRule } from "@oxlint/plugins";

import { pathOf } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.), without its per-file debt ceiling. The lint config scopes it to test files.

const RUNNERS = new Set(
  [
    "runCallback",
    "runCallbackWith",
    "runFork",
    "runForkWith",
    "runPromise",
    "runPromiseExit",
    "runPromiseExitWith",
    "runPromiseWith",
    "runSync",
    "runSyncExit",
    "runSyncExitWith",
    "runSyncWith",
  ].map((method) => `Effect.${method}`),
);

/** Tests run Effects through @effect/vitest, which owns the runtime, TestClock and scope. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow creating or running Effect runtimes by hand in tests; use @effect/vitest.",
    },
    messages: {
      manualRuntime:
        "Don't call {{runner}} in a test. Use `it.effect(...)` from @effect/vitest with test layers.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const runner = pathOf(node.callee);

        if (runner !== null && (RUNNERS.has(runner) || runner === "ManagedRuntime.make")) {
          context.report({ node: node.callee, messageId: "manualRuntime", data: { runner } });
        }
      },
    };
  },
});
