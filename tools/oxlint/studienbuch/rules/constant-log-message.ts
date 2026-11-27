import { defineRule, type ESTree } from "@oxlint/plugins";

import { sources, tests, type Scope } from "../scope.ts";
import { isStringLiteral } from "../syntax.ts";

export const scope: Scope = { files: sources, excludeFiles: tests };

const LOGGING = new Set([
  "log",
  "logTrace",
  "logDebug",
  "logInfo",
  "logWarning",
  "logError",
  "logFatal",
  "annotateLogs",
  "annotateSpans",
  "annotateCurrentSpan",
]);

const isEffectCall = (node: ESTree.CallExpression) =>
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  node.callee.object.type === "Identifier" &&
  node.callee.object.name === "Effect" &&
  node.callee.property.type === "Identifier" &&
  LOGGING.has(node.callee.property.name);

/** Calls that turn any value into text: `String(x)`, `JSON.stringify(x)` and `x.toString()`. */
const isStringify = (node: ESTree.CallExpression) =>
  (node.callee.type === "Identifier" && node.callee.name === "String") ||
  (node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    (node.callee.property.name === "toString" ||
      (node.callee.property.name === "stringify" &&
        node.callee.object.type === "Identifier" &&
        node.callee.object.name === "JSON")));

/** `+` with a string on either side; a sum of counts is no text. */
const isConcatenation = (node: ESTree.Node): boolean =>
  isStringLiteral(node) ||
  node.type === "TemplateLiteral" ||
  (node.type === "BinaryExpression" &&
    node.operator === "+" &&
    (isConcatenation(node.left) || isConcatenation(node.right)));

/** The places inside a log call's argument where a value becomes text, without entering functions. */
const textOf = (node: ESTree.Node | null | undefined): ReadonlyArray<ESTree.Node> => {
  if (node === null || node === undefined) return [];

  if (node.type === "TemplateLiteral") return node.expressions.length > 0 ? [node] : [];

  if (node.type === "BinaryExpression") {
    return isConcatenation(node) ? [node] : [...textOf(node.left), ...textOf(node.right)];
  }

  // An error's message can quote anything, a library's error body included.
  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier" &&
    node.property.name === "message"
  ) {
    return [node];
  }

  if (node.type === "CallExpression") return isStringify(node) ? [node] : [];

  if (node.type === "ConditionalExpression") {
    return [...textOf(node.consequent), ...textOf(node.alternate)];
  }

  if (node.type === "LogicalExpression") return [...textOf(node.left), ...textOf(node.right)];

  if (node.type === "ObjectExpression") {
    return node.properties.flatMap((property) =>
      property.type === "Property" ? textOf(property.value) : [],
    );
  }

  if (node.type === "ArrayExpression") {
    return node.elements.flatMap((element) =>
      element === null || element.type === "SpreadElement" ? [] : textOf(element),
    );
  }

  return [];
};

/** Log messages and annotations stay constant, so a value never reaches telemetry as text. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow interpolated or stringified values in log messages, log annotations and span annotations.",
    },
    messages: {
      interpolated:
        "Keep log messages and annotations constant: a value turned into text can carry a name or an address. Log ids, tags and counts as annotations, as they are.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isEffectCall(node)) return;

        for (const argument of node.arguments) {
          for (const found of textOf(argument)) {
            context.report({ node: found, messageId: "interpolated" });
          }
        }
      },
    };
  },
});
