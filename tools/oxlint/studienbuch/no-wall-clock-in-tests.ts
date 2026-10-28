import { defineRule, type ESTree } from "@oxlint/plugins";

import { memberKey, pathOf, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (pingdotgg/t3code, oxlint-plugin-t3code).

const WALL_CLOCK_CALLS = new Set([
  "Date.now",
  "performance.now",
  "process.hrtime",
  "process.hrtime.bigint",
]);

const VI_MOCKING_FUNCTIONS = new Set(["vi.fn", "vi.mock", "vi.setSystemTime", "vi.spyOn"]);

const MOCK_METHODS = new Set([
  "mockImplementation",
  "mockImplementationOnce",
  "mockResolvedValue",
  "mockResolvedValueOnce",
  "mockReturnValue",
  "mockReturnValueOnce",
]);

function isMockingCall(callee: ESTree.Node): boolean {
  const target = unwrap(callee);

  if (target.type !== "MemberExpression") return false;

  const key = memberKey(target);

  return (key !== null && MOCK_METHODS.has(key)) || VI_MOCKING_FUNCTIONS.has(pathOf(target) ?? "");
}

// A reading passed to a mock, or made inside a `vi.mock` factory, seeds fake time instead of
// measuring the runner.
function isMockArgument(node: ESTree.Node): boolean {
  let child = node;
  let current: ESTree.Node | null = node.parent;

  while (current !== null) {
    if (
      current.type === "CallExpression" &&
      current.callee !== child &&
      isMockingCall(current.callee)
    ) {
      return true;
    }

    child = current;
    current = current.parent;
  }

  return false;
}

/** Tests assert on events and counts, never on elapsed time. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow wall-clock readings (Date.now, new Date(), performance.now, process.hrtime) in tests.",
    },
    messages: {
      wallClock:
        "Wall-clock reading in a test: elapsed-time assertions pass or fail with the runner's load. Use TestClock or `Clock` under `it.effect`, `vi.setSystemTime`, or a fixed epoch.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (WALL_CLOCK_CALLS.has(pathOf(node.callee) ?? "") && !isMockArgument(node)) {
          context.report({ node, messageId: "wallClock" });
        }
      },
      NewExpression(node) {
        if (
          node.arguments.length === 0 &&
          pathOf(node.callee) === "Date" &&
          !isMockArgument(node)
        ) {
          context.report({ node, messageId: "wallClock" });
        }
      },
    };
  },
});
