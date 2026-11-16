import { defineRule } from "@oxlint/plugins";

import { memberKey, unwrap } from "./syntax.ts";

const RUNS = new Set(["stream", "query"]);

const ENGINE_KEYS = new Set(["SyncClient", "DeviceSchema"]);

/**
 * A screen's live read is a `SyncQuery` mounted with `SyncQuery.family`, whose keys come from the
 * tables and engine queries it names. A key list picked by hand drifts from what the read reads,
 * and the engine's own keys change with every write and pull.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `Reactivity.stream`, `Reactivity.query`, `withReactivity` and the engine's key list in feature code.",
    },
    messages: {
      handRolled:
        "Write the read as `SyncQuery.read({ tables, queries, run })` (or `SyncQuery.make` for one select) from @stu/sync/client and mount it with `SyncQuery.family`. Its keys are the tables and engine queries it names, so it runs again only when one of them changes.",
    },
  },
  create(context) {
    const nameOf = (node: Parameters<typeof unwrap>[0]) => {
      const object = unwrap(node);

      return object.type === "Identifier" ? object.name : "";
    };

    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);

        if (callee.type !== "MemberExpression") return;
        const key = memberKey(callee) ?? "";

        if (key === "withReactivity" || (RUNS.has(key) && nameOf(callee.object) === "Reactivity")) {
          context.report({ node, messageId: "handRolled" });
        }
      },
      MemberExpression(node) {
        if (memberKey(node) === "keys" && ENGINE_KEYS.has(nameOf(node.object))) {
          context.report({ node, messageId: "handRolled" });
        }
      },
    };
  },
});
