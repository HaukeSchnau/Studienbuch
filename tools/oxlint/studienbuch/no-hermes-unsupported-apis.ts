import { defineRule, type ESTree } from "@oxlint/plugins";

import { memberKey, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). T3 checks calls only, which misses `const S = Intl.Segmenter; new S()`, so here every read
// counts except a feature test: `typeof`, `in` or a comparison with `undefined`.

// Hermes V1 lacks these. They type-check under `lib: ["ESNext"]` and crash on a device.
const UNSUPPORTED_METHODS = new Map([
  ["toSorted", "Copy, then sort: [...items].sort(compare)."],
  ["toReversed", "Copy, then reverse: [...items].reverse()."],
  ["toSpliced", "Copy the array, then splice the copy."],
]);

const UNSUPPORTED_GLOBALS = new Map([
  ["Intl.Segmenter", "Split text without it, for example by code point."],
]);

const GLOBAL_OBJECTS = new Set(["globalThis", "global", "window", "self"]);
const EQUALITY = new Set(["===", "!==", "==", "!="]);

/** `Intl.Segmenter` for it and for `globalThis.Intl["Segmenter"]`, null for anything dynamic. */
function globalPath(node: ESTree.Node): string | null {
  const expression = unwrap(node);

  if (expression.type === "Identifier") return expression.name;

  if (expression.type !== "MemberExpression") return null;

  const object = globalPath(expression.object);
  const key = memberKey(expression);

  if (object === null || key === null) return null;

  return GLOBAL_OBJECTS.has(object) ? key : `${object}.${key}`;
}

/** Whether `node` is only tested for existence: `typeof x`, `x in y` or `x === undefined`. */
function isFeatureTest(node: ESTree.Node): boolean {
  let child = node;
  let parent = node.parent;

  while (parent !== null && unwrap(parent) !== parent) {
    child = parent;
    parent = parent.parent;
  }

  if (parent?.type === "UnaryExpression") return parent.operator === "typeof";

  if (parent?.type !== "BinaryExpression") return false;

  if (parent.operator === "in") return true;

  const other = parent.left === child ? parent.right : parent.left;

  return EQUALITY.has(parent.operator) && other.type === "Identifier" && other.name === "undefined";
}

/** Device code uses only what Hermes V1 implements. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow APIs that Hermes V1 does not implement in code that runs on devices.",
    },
    messages: {
      unsupported: "Hermes does not implement {{api}}. {{instead}}",
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isFeatureTest(node)) return;

        const path = globalPath(node);
        const global = path === null ? undefined : UNSUPPORTED_GLOBALS.get(path);

        if (global !== undefined) {
          context.report({ node, messageId: "unsupported", data: { api: path, instead: global } });

          return;
        }

        const method = memberKey(node);
        const instead = method === null ? undefined : UNSUPPORTED_METHODS.get(method);

        if (instead !== undefined) {
          context.report({
            node: node.property,
            messageId: "unsupported",
            data: { api: `Array#${method}`, instead },
          });
        }
      },
    };
  },
});
