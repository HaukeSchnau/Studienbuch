import { defineRule, type ESTree } from "@oxlint/plugins";

import { pathOf, unwrap } from "../syntax.ts";

const EQUALITY = new Set(["===", "!==", "==", "!="]);

/** Values compare by structure, not by the text `JSON.stringify` happens to produce. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow comparing two values through `JSON.stringify`.",
    },
    messages: {
      jsonEquality:
        "Two values compared by their JSON text differ when their keys come in another order, and match when `undefined`, a `Map`, a `Set` or a function hides a difference. Compare them with `Equal.equals`, which is structural in Effect 4, or with the schema's `Schema.toEquivalence`.",
    },
  },
  create(context) {
    const isStringify = (node: ESTree.Node) => {
      const expression = unwrap(node);

      return expression.type === "CallExpression" && pathOf(expression.callee) === "JSON.stringify";
    };

    return {
      BinaryExpression(node) {
        if (EQUALITY.has(node.operator) && isStringify(node.left) && isStringify(node.right)) {
          context.report({ node, messageId: "jsonEquality" });
        }
      },
    };
  },
});
