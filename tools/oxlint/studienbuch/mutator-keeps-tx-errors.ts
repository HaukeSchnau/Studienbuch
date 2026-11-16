import { type Context, defineRule, type ESTree } from "@oxlint/plugins";

import { importOf, isEffectModule } from "./bindings.ts";
import { layoutPath } from "./repository-path.ts";
import { propertyKey, unwrap } from "./syntax.ts";

// Members of `effect/Effect` that take a failure out of the error channel or rewrite it.
const HANDLER_PREFIXES = ["catch", "match", "orDie", "orElse", "ignore", "retry"];

const HANDLERS = new Set([
  "eventually",
  "exit",
  "firstSuccessOf",
  "flip",
  "mapBoth",
  "mapBothEager",
  "mapError",
  "mapErrorEager",
  "option",
  "result",
  "sandbox",
]);

const isHandler = (name: string) =>
  HANDLERS.has(name) || HANDLER_PREFIXES.some((prefix) => name.startsWith(prefix));

/** Whether `node` is the options object of `Sync.mutator(name, options)`. */
function isMutatorOptions(context: Context, node: ESTree.Node): boolean {
  const call = node.parent;

  if (call?.type !== "CallExpression" || call.arguments[1] !== node) return false;

  const callee = unwrap(call.callee);

  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === "mutator" &&
    callee.object.type === "Identifier" &&
    importOf(context, callee.object)?.name === "Sync"
  );
}

/** Whether `node` sits in the `run` of a mutator definition. */
function inMutatorRun(context: Context, node: ESTree.Node): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (
      current.type === "Property" &&
      propertyKey(current) === "run" &&
      current.parent?.type === "ObjectExpression" &&
      isMutatorOptions(context, current.parent)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * A mutator lets every failure through. SQLite can roll a device's whole transaction back on its
 * own, and a `SqlError` caught there would turn into a refusal written outside any transaction. A
 * caught or `orDie`d `Tx` refusal makes the device and the server settle a command differently.
 * packages/core runs inside mutators, so the rule covers all of it.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Forbid handling errors inside a mutator's run, or anywhere in packages/core.",
    },
    messages: {
      handled:
        "A mutator lets `Tx` errors through: `Effect.{{name}}` would turn a database failure or a `Tx` refusal into a different outcome on the device than on the server. Check with `tx.get` and fail with the mutator's own refusal instead.",
    },
  },
  create(context) {
    const path = layoutPath(context);
    const everywhere = path.startsWith("packages/core/") && !/\.test\.tsx?$/u.test(path);

    return {
      MemberExpression(node) {
        if (
          node.computed ||
          node.property.type !== "Identifier" ||
          !isHandler(node.property.name) ||
          node.object.type !== "Identifier" ||
          !isEffectModule(context, node.object)
        ) {
          return;
        }

        if (everywhere || inMutatorRun(context, node)) {
          context.report({ node, messageId: "handled", data: { name: node.property.name } });
        }
      },
    };
  },
});
