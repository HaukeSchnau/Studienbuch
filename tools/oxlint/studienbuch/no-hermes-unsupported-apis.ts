import { defineRule, type ESTree } from "@oxlint/plugins";

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

/** `Intl.Segmenter` for `Intl.Segmenter` and `globalThis.Intl.Segmenter`, null for anything dynamic. */
function globalPath(node: ESTree.Node): string | null {
  if (node.type === "Identifier") return node.name;

  if (node.type !== "MemberExpression" || node.computed || node.property.type !== "Identifier") {
    return null;
  }

  const object = globalPath(node.object);

  if (object === null) return null;

  return GLOBAL_OBJECTS.has(object) ? node.property.name : `${object}.${node.property.name}`;
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
        const path = globalPath(node);
        const global = path === null ? undefined : UNSUPPORTED_GLOBALS.get(path);

        if (global !== undefined) {
          context.report({ node, messageId: "unsupported", data: { api: path, instead: global } });

          return;
        }

        if (node.computed || node.property.type !== "Identifier") return;

        const method = UNSUPPORTED_METHODS.get(node.property.name);

        if (method !== undefined) {
          context.report({
            node: node.property,
            messageId: "unsupported",
            data: { api: `Array#${node.property.name}`, instead: method },
          });
        }
      },
    };
  },
});
