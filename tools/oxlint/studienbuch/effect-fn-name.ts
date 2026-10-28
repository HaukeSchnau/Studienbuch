import { defineRule, type ESTree } from "@oxlint/plugins";

import { isStringLiteral } from "./string-literal.ts";

// `Service.operation`, as in `SyncWriter.write` or `Sync.Client.push`.
const SPAN_NAME = /^(?:[A-Z][A-Za-z0-9]*\.)+[a-z][A-Za-z0-9]*$/u;

function isEffectFn(node: ESTree.Node): boolean {
  return (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.object.type === "Identifier" &&
    node.object.name === "Effect" &&
    node.property.type === "Identifier" &&
    node.property.name === "fn"
  );
}

/** `Effect.fn` names its span `Service.operation`. `Effect.fnUntraced` is the unnamed form. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: 'Require `Effect.fn` to name its span as `"Service.operation"`.',
    },
    messages: {
      spanName:
        'Name the span: `Effect.fn("Service.operation")(function* () { ... })`, as in `Effect.fn("SyncWriter.write")`.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isEffectFn(node.callee)) return;

        const first = node.arguments[0];

        if (first === undefined || !isStringLiteral(first) || !SPAN_NAME.test(first.value)) {
          context.report({ node, messageId: "spanName" });
        }
      },
    };
  },
});
