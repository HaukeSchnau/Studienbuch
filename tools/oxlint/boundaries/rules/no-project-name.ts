import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

const PROJECT_NAME = "studienbuch";

/**
 * Keep the project's own names out of otherwise reusable code.
 *
 * A module that hardcodes `studienbuch` cannot be copied into another project without a hunt. The
 * fix is always the same: move the literal into that package's `project.ts`, which is the one file
 * a reader (or a future extraction) has to change. `overrides` in the lint config exempts those
 * files, so the rule and the convention cannot drift apart.
 */
export const noProjectNameRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        'Disallow the project name "studienbuch" in string literals outside project vocabulary modules.',
    },
    messages: {
      projectName:
        'Move "{{value}}" into this package\'s project.ts. Naming the project here makes the module project-specific, and everything outside project.ts is meant to stay copyable.',
    },
  },
  create(context) {
    const report = (node: ESTree.Node, value: string) => {
      if (!value.toLowerCase().includes(PROJECT_NAME)) return;
      context.report({ node, messageId: "projectName", data: { value } });
    };

    return {
      Literal(node) {
        // `String` rather than a `typeof` narrowing: numeric and regex literals stringify to
        // something that cannot contain the project name, so the check stays correct without
        // inspecting the node's runtime shape.
        report(node, String(node.value));
      },
      TemplateElement(node) {
        report(node, node.value.raw);
      },
    };
  },
});
