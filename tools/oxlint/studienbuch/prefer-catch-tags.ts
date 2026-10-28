import { defineRule } from "@oxlint/plugins";

import { isEffectModule } from "./bindings.ts";
import { moduleExportName } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.).

/** One way to catch tagged errors, so adding a second tag never means rewriting the first. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Require `Effect.catchTags` over `Effect.catchTag`.",
    },
    messages: {
      catchTags: "Catch known tags with `Effect.catchTags({ Tag: handler })`, even for one tag.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "effect/Effect") return;

        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            moduleExportName(specifier.imported) === "catchTag"
          ) {
            context.report({ node: specifier, messageId: "catchTags" });
          }
        }
      },
      MemberExpression(node) {
        if (
          !node.computed &&
          node.property.name === "catchTag" &&
          node.object.type === "Identifier" &&
          isEffectModule(context, node.object)
        ) {
          context.report({ node, messageId: "catchTags" });
        }
      },
    };
  },
});
