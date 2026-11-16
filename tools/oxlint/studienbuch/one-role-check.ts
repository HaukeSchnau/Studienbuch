import { defineRule } from "@oxlint/plugins";

import { layoutPath } from "./repository-path.ts";
import { memberKey, propertyKey } from "./syntax.ts";

// Who may write is decided in one module, which both engines ask, so a command the device takes
// is never refused by the server for a role rule the device checked differently.
const HOME = "packages/sync/src/definition/Sync.ts";

/** A table's `writableBy` is read only by the definition API. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Forbid reading `writableBy` outside the sync definition API.",
    },
    messages: {
      writableBy:
        "Ask `Sync.mayWrite` for a row a run wrote, or `Sync.maySeal` for a sealed write, instead of reading `writableBy`, so the device and the server check roles alike.",
    },
  },
  create(context) {
    if (layoutPath(context) === HOME) return {};

    return {
      MemberExpression(node) {
        if (memberKey(node) === "writableBy") context.report({ node, messageId: "writableBy" });
      },
      // `const { writableBy } = table` reads it too.
      Property(node) {
        if (node.parent?.type === "ObjectPattern" && propertyKey(node) === "writableBy") {
          context.report({ node, messageId: "writableBy" });
        }
      },
    };
  },
});
