import { defineRule, type ESTree } from "@oxlint/plugins";

import { isStringLiteral } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). Comments aren't copy, so only strings and JSX text count.

const EM_DASH = "—";

/** Copy that people or agents read has no em dashes. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow em dashes in strings and JSX text that users or agents read.",
    },
    messages: {
      emDash: "No em dashes in copy. Use a period or a comma instead.",
    },
  },
  create(context) {
    const check = (node: ESTree.Node, text: string | null) => {
      if (text?.includes(EM_DASH) === true) context.report({ node, messageId: "emDash" });
    };

    return {
      Literal(node) {
        if (isStringLiteral(node)) check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked);
      },
      JSXText(node) {
        check(node, node.value);
      },
    };
  },
});
