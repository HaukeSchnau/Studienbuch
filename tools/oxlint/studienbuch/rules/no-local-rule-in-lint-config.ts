import { defineRule } from "@oxlint/plugins";

import { isStringLiteral } from "../syntax.ts";
import type { Scope } from "../scope.ts";

export const scope: Scope = {
  files: ["vite.config.ts", "tools/oxlint/fixtures/no-local-rule-in-lint-config.ts"],
};

/**
 * A rule of this plugin says where it runs in its own file, so two branches that each add a rule
 * edit no common line of the lint config.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow naming a `studienbuch/` rule in the lint config.",
    },
    messages: {
      named:
        "Say where `{{rule}}` runs with `export const scope` in tools/oxlint/studienbuch/rules/{{file}}.ts. The plugin turns each rule on from its own scope, so two new rules never edit the same lines of vite.config.ts.",
    },
  },
  create(context) {
    return {
      Literal(node) {
        if (!isStringLiteral(node) || !node.value.startsWith("studienbuch/")) return;

        const rule = node.value;

        context.report({
          node,
          messageId: "named",
          data: { rule, file: rule.slice("studienbuch/".length) },
        });
      },
    };
  },
});
