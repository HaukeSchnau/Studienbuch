import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

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

/** Require failures to be represented in return types instead of exceptions or rejected promises. */
export const noThrowingErrorsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow throw statements and Promise.reject calls.",
    },
    messages: {
      rejectedPromise:
        "Promise.reject hides failure outside the return type. Return an explicit failure value or use a typed Effect error channel.",
      thrown:
        "Thrown errors hide failure outside the return type. Return an explicit failure value or use a typed Effect error channel.",
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
    };
  },
});
