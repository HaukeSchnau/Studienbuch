import { defineRule, type ESTree } from "@oxlint/plugins";

import { isStringLiteral } from "./string-literal.ts";

// `Domain.ClassName`, as in `Homework.NotFound`.
const DOMAIN_TAG = /^[A-Z][A-Za-z0-9]*\.(?<name>[A-Z][A-Za-z0-9]*)$/u;

function calleeName(node: ESTree.Node): string | null {
  if (node.type === "Identifier") return node.name;

  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }

  return null;
}

/**
 * The tag literal of `Data.TaggedError("Tag")` or `Schema.TaggedError<Self>()("Tag", fields)`: null
 * when the tag isn't a literal, undefined when the class extends no tagged error.
 */
function taggedErrorTag(superClass: ESTree.Node): ESTree.StringLiteral | null | undefined {
  let tag: ESTree.StringLiteral | null = null;
  let node = superClass;

  while (node.type === "CallExpression") {
    const first = node.arguments[0];

    if (tag === null && first !== undefined && isStringLiteral(first)) tag = first;

    if (calleeName(node.callee) === "TaggedError") return tag;

    node = node.callee;
  }

  return undefined;
}

/** Errors are named `Domain.ClassName` in their tag, and the class has no `Error` suffix. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Require tagged errors to carry a `Domain.ClassName` tag and no `Error` suffix.",
    },
    messages: {
      errorSuffix:
        "Name the error for what happened, without the `Error` suffix: `{{suggestion}}`. Its tag already marks it as an error.",
      tagName:
        "Tag the error `<Domain>.{{name}}`, as in `Homework.{{name}}`, so the tag names its domain and its class.",
    },
  },
  create(context) {
    const check = (node: ESTree.Class) => {
      if (node.id === null || node.superClass === null) return;

      const tag = taggedErrorTag(node.superClass);

      if (tag === undefined) return;

      const { name } = node.id;

      if (name.endsWith("Error")) {
        context.report({
          node: node.id,
          messageId: "errorSuffix",
          data: { suggestion: name.slice(0, -"Error".length) },
        });
      }

      if (tag !== null && DOMAIN_TAG.exec(tag.value)?.groups?.name !== name) {
        context.report({ node: tag, messageId: "tagName", data: { name } });
      }
    };

    return { ClassDeclaration: check, ClassExpression: check };
  },
});
