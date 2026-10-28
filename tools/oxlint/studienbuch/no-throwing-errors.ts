import { defineRule, type ESTree } from "@oxlint/plugins";

// Modules whose exports throw when a check fails. Tests assert through @effect/vitest instead.
const ASSERTION_MODULES = new Set([
  "assert",
  "assert/strict",
  "node:assert",
  "node:assert/strict",
  "invariant",
  "tiny-invariant",
]);

function isPromiseReject(node: ESTree.CallExpression): boolean {
  const { callee } = node;

  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Promise" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "reject"
  );
}

/** Nothing throws: a failure is a value in the return type or in Effect's error channel. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow throw, Promise.reject, assertion modules and assertion signatures.",
    },
    messages: {
      thrown:
        "Thrown errors hide failure outside the return type. Return an explicit failure value or use a typed Effect error channel; defects use Effect.die.",
      rejectedPromise:
        "Promise.reject hides failure outside the return type. Return an explicit failure value or use a typed Effect error channel.",
      assertionModule:
        "`{{module}}` throws when its check fails. Return an explicit failure value or use a typed Effect error channel; tests assert through @effect/vitest.",
      assertionSignature:
        "An `asserts` signature can only fail by throwing. Return the refined value, an Option or a typed failure instead.",
    },
  },
  create(context) {
    return {
      ThrowStatement(node) {
        context.report({ node, messageId: "thrown" });
      },
      CallExpression(node) {
        if (isPromiseReject(node)) context.report({ node, messageId: "rejectedPromise" });
      },
      ImportDeclaration(node) {
        const module = node.source.value;

        if (ASSERTION_MODULES.has(module)) {
          context.report({ node: node.source, messageId: "assertionModule", data: { module } });
        }
      },
      TSTypePredicate(node) {
        if (node.asserts) context.report({ node, messageId: "assertionSignature" });
      },
    };
  },
});
