import { defineRule, type ESTree } from "@oxlint/plugins";

import { isFunction, memberKey, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). The lint config scopes it to test files.

const TEST_FUNCTIONS = new Set(["describe", "it", "suite", "test"]);
const EACH_CAPABLE_MODIFIERS = new Set(["effect", "live"]);
const LOOPS = new Set(["ForStatement", "ForInStatement", "ForOfStatement"]);

// node:test has no `.each`, so files written against it keep their loops.
const NODE_TEST_IMPORT = /["']node:test["']/u;

/** `it`, `describe` or `it.effect` for a call that declares a test, null for anything else. */
function testCallName(callee: ESTree.Node): string | null {
  const expression = unwrap(callee);

  if (expression.type === "Identifier") {
    return TEST_FUNCTIONS.has(expression.name) ? expression.name : null;
  }

  if (expression.type !== "MemberExpression") return null;

  const object = unwrap(expression.object);
  const modifier = memberKey(expression);

  if (object.type !== "Identifier" || !TEST_FUNCTIONS.has(object.name)) return null;

  return modifier !== null && EACH_CAPABLE_MODIFIERS.has(modifier)
    ? `${object.name}.${modifier}`
    : null;
}

/** Whether a `for` loop holds `node` within its own function. */
function isInsideLoop(node: ESTree.Node): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (LOOPS.has(current.type)) return true;

    if (isFunction(current)) return false;
  }

  return false;
}

/** Table-driven tests use `.each`, so every case gets its own name in the report. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow declaring tests inside a for loop; use `it.each`, `it.effect.each` or `describe.each`.",
    },
    messages: {
      testInLoop: "Don't call {{name}}(…) inside a for loop. Use {{name}}.each(cases)(name, …).",
    },
  },
  create(context) {
    if (NODE_TEST_IMPORT.test(context.sourceCode.text)) return {};

    return {
      CallExpression(node) {
        const name = testCallName(node.callee);

        if (name !== null && isInsideLoop(node)) {
          context.report({ node: node.callee, messageId: "testInLoop", data: { name } });
        }
      },
    };
  },
});
