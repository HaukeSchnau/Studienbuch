import { defineRule, type ESTree } from "@oxlint/plugins";

import { memberKey, propertyKey, unwrap } from "../syntax.ts";
import { clientCode, type Scope } from "../scope.ts";

export const scope: Scope = { files: clientCode };

// The options that make expo-sqlite and Effect's wasm client report every changed row, and the
// calls that install such a report: expo-sqlite's listener and wa-sqlite's hook.
const OPTIONS = new Set(["enableChangeListener", "installReactivityHooks"]);

const CALLS = new Set(["addDatabaseChangeListener", "update_hook"]);

const calleeName = (callee: ESTree.Node) => {
  const expression = unwrap(callee);

  if (expression.type === "Identifier") return expression.name;

  return expression.type === "MemberExpression" ? memberKey(expression) : null;
};

/** The sync engine refreshes the screens itself, so no SQLite client reports its rows. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow SQLite update hooks; the sync engine invalidates the screens' queries once per transaction.",
    },
    messages: {
      updateHook:
        "The sync engine invalidates the screens' queries once per transaction (`SyncClient.commit`). An update hook calls into JavaScript once per changed row, a native event on a phone and a worker message on the web, and names physical tables such as `sync_outbox`, which the engine's own keys reuse.",
    },
  },
  create(context) {
    return {
      Property(node) {
        if (node.parent?.type !== "ObjectExpression") return;

        if (!OPTIONS.has(propertyKey(node) ?? "")) return;

        const value = unwrap(node.value);

        if (value.type === "Literal" && value.value === false) return;

        context.report({ node, messageId: "updateHook" });
      },
      CallExpression(node) {
        if (CALLS.has(calleeName(node.callee) ?? "")) {
          context.report({ node: node.callee, messageId: "updateHook" });
        }
      },
    };
  },
});
