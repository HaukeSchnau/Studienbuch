import { defineRule, type ESTree } from "@oxlint/plugins";

import { enclosingFunction, type FunctionNode, memberKey } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (pingdotgg/t3code, oxlint-plugin-t3code). T3 searches
// each `use…` function's body for a hook call. This walks up from the hook calls instead, so it
// needs no traversal over a node's untyped fields.

const HOOK_NAME = /^use[A-Z]/u;

// Bare `use` is React 19's `use(promise | context)`, which is a hook call too.
const HOOK_CALLEE = /^use(?:[A-Z]|$)/u;

function isHookCallee(callee: ESTree.Node): boolean {
  if (callee.type === "Identifier") return HOOK_CALLEE.test(callee.name);

  if (callee.type !== "MemberExpression") return false;

  return HOOK_CALLEE.test(memberKey(callee) ?? "");
}

/**
 * A function named `use…` calls a hook. The `use` prefix tells readers and
 * `studienbuch/no-ad-hoc-state-or-effects` that it is a custom hook, and the React Compiler skips a
 * function that calls none.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `use…` functions that call no hook.",
    },
    messages: {
      hookless:
        "`{{name}}` calls no hook, so the React Compiler skips it and rebuilds what it returns on every render. Rename it to a plain function, or read the hook it depends on inside it.",
    },
  },
  create(context) {
    const named: Array<{ readonly name: ESTree.BindingIdentifier; readonly fn: FunctionNode }> = [];
    // A hook call inside a nested callback runs when the callback runs, not during render, so it
    // makes only that callback a hook caller.
    const callers = new Set<ESTree.Node>();

    return {
      FunctionDeclaration(node) {
        if (node.id !== null && HOOK_NAME.test(node.id.name)) {
          named.push({ name: node.id, fn: node });
        }
      },
      VariableDeclarator(node) {
        const init = node.init;

        if (
          node.id.type === "Identifier" &&
          HOOK_NAME.test(node.id.name) &&
          (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression")
        ) {
          named.push({ name: node.id, fn: init });
        }
      },
      CallExpression(node) {
        if (!isHookCallee(node.callee)) return;

        const caller = enclosingFunction(node);

        if (caller !== null) callers.add(caller);
      },
      "Program:exit"() {
        for (const { name, fn } of named) {
          if (!callers.has(fn)) {
            context.report({ node: name, messageId: "hookless", data: { name: name.name } });
          }
        }
      },
    };
  },
});
