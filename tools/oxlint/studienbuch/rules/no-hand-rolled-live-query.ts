import { defineRule } from "@oxlint/plugins";

import { memberKey, unwrap } from "../syntax.ts";
import { tests, withFixtures, type Scope } from "../scope.ts";

// The Sync Lab shows every table and the engine's own state, so it follows every key.
export const scope: Scope = {
  files: withFixtures("apps/app/src/{features,domain-ui}/**"),
  excludeFiles: [...withFixtures("apps/app/src/features/sync-lab/**"), ...tests],
};

const RUNS = new Set(["stream", "query"]);

const SQL_RUNS = new Set(["reactive", "reactiveMailbox"]);

const ENGINE_KEYS = new Set(["SyncClient", "DeviceSchema"]);

/**
 * A screen's live read is a `SyncQuery` mounted with `SyncQuery.family`, whose keys come from the
 * tables and engine queries it names. A key list picked by hand drifts from what the read reads,
 * the engine's own keys change with every write and pull, and the SQL client's `reactive` follows
 * a `Reactivity` the engine never invalidates.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `Reactivity` streams and queries, `sql.reactive`, `withReactivity` and the engine's key list in feature code.",
    },
    messages: {
      handRolled:
        "Write the read as `SyncQuery.read({ tables, queries, run })` (or `SyncQuery.make` for one select) from @stu/sync/client and mount it with `SyncQuery.family`. Its keys are the tables and engine queries it names, so it runs again only when one of them changes.",
      sqlReactive:
        "Use `SyncQuery.read({ tables, queries, run })` from @stu/sync/client, mounted with `SyncQuery.family`. The SQL client's `{{method}}` listens on the client's own `Reactivity`, which isn't the engine's, so the read would never run again after a write or a pull.",
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

        if (SQL_RUNS.has(key)) {
          context.report({ node, messageId: "sqlReactive", data: { method: key } });
        } else if (
          key === "withReactivity" ||
          (RUNS.has(key) && nameOf(callee.object).toLowerCase() === "reactivity")
        ) {
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
