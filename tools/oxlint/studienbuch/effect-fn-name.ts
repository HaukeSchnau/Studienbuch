import { defineRule } from "@oxlint/plugins";

import { isStringLiteral, pathOf } from "./syntax.ts";

// `Service.operation`, as in `SyncWriter.write` or `Sync.Client.push`.
const SPAN_NAME = /^(?:[A-Z][A-Za-z0-9]*\.)+[a-z][A-Za-z0-9]*$/u;

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
        if (pathOf(node.callee) !== "Effect.fn") return;

        const first = node.arguments[0];

        if (first === undefined || !isStringLiteral(first) || !SPAN_NAME.test(first.value)) {
          context.report({ node, messageId: "spanName" });
        }
      },
    };
  },
});
