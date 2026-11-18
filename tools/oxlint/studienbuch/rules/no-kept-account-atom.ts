import { defineRule, type ESTree } from "@oxlint/plugins";

import { isFunction, pathOf } from "../syntax.ts";
import { withFixtures, type Scope } from "../scope.ts";

export const scope: Scope = { files: withFixtures("apps/app/src/features/**") };

// An account's atoms are families keyed by its id.
const ACCOUNT = /^_?accountId$/u;

/** Whether `node` sits in the callback of an `Atom.family` keyed by an account. */
function accountFamily(node: ESTree.Node): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    const call = current.parent;

    if (
      isFunction(current) &&
      call?.type === "CallExpression" &&
      pathOf(call.callee) === "Atom.family" &&
      call.arguments[0] === current &&
      current.params[0]?.type === "Identifier" &&
      ACCOUNT.test(current.params[0].name)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * No atom of an account stays alive. The registry keeps a kept atom, and every atom it read, until
 * the app ends: after sign-out, the next person on the device would meet the last student's data.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `Atom.keepAlive` in an `Atom.family` keyed by an account.",
    },
    messages: {
      kept: "An account's atom that stays alive outlives sign-out, with what it read in memory. Let the component that outlives its screen mount it (`useAtomMount`), or keep the value in `AccountState.memory`, which forgets it when the device's session changes.",
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (pathOf(node) === "Atom.keepAlive" && accountFamily(node)) {
          context.report({ node, messageId: "kept" });
        }
      },
    };
  },
});
