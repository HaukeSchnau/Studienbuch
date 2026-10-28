import { defineRule, type ESTree } from "@oxlint/plugins";

import { isStringLiteral } from "./string-literal.ts";

// A URL on one Studienbuch deployment or a local server. One web build serves every preview, beta
// and production from its own origin, and native builds read EXPO_PUBLIC_API_URL (AGENTS.md,
// "Baking in an origin").
const OWN_ORIGIN =
  /(?:(?:https?|wss?):)?\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|(?:[\w-]+\.)*studienbuch\.(?:app|schnau\.dev))(?![\w.-])/iu;

/** Client code reaches the server through its own origin, never through a literal host. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow URLs that name a Studienbuch deployment or a local server in client code.",
    },
    messages: {
      bakedOrigin:
        "`{{origin}}` pins one deployment. Web code calls its own origin through a relative URL such as `/api/rpc`; native code reads EXPO_PUBLIC_API_URL.",
    },
  },
  create(context) {
    const check = (text: string, node: ESTree.Node) => {
      const origin = OWN_ORIGIN.exec(text)?.[0];

      if (origin !== undefined) {
        context.report({ node, messageId: "bakedOrigin", data: { origin } });
      }
    };

    return {
      Literal(node) {
        if (isStringLiteral(node)) check(node.value, node);
      },
      TemplateElement(node) {
        check(node.value.cooked ?? node.value.raw, node);
      },
    };
  },
});
