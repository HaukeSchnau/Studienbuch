import type { Context, ESTree } from "@oxlint/plugins";

import { enclosingFunction, type FunctionNode } from "./syntax.ts";

const HOOK_NAME = /^use[A-Z]/u;

/** The `export` that declares `fn`, when `fn` is named like a hook and exported in place. */
function hookExport(fn: FunctionNode): ESTree.Node | null {
  const { parent } = fn;

  if (fn.type === "FunctionDeclaration") {
    const exported =
      parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration";

    return exported && fn.id !== null && HOOK_NAME.test(fn.id.name) ? parent : null;
  }

  // `export const useThing = () => …`
  if (
    parent.type !== "VariableDeclarator" ||
    parent.init !== fn ||
    parent.id.type !== "Identifier" ||
    !HOOK_NAME.test(parent.id.name)
  ) {
    return null;
  }

  const declaration = parent.parent;

  return declaration.parent?.type === "ExportNamedDeclaration" ? declaration.parent : null;
}

/**
 * Whether `node` sits directly in an exported `use…` hook with a doc comment, the one place where
 * code may reach past the homes AGENTS.md gives state, effects and platform differences.
 */
export function isInDocumentedHook(context: Context, node: ESTree.Node): boolean {
  const fn = enclosingFunction(node);
  const declaration = fn === null ? null : hookExport(fn);

  return (
    declaration !== null &&
    context.sourceCode
      .getCommentsBefore(declaration)
      .some(
        (comment) =>
          comment.type === "Block" &&
          comment.value.startsWith("*") &&
          comment.value.replaceAll(/[\s*]/gu, "") !== "",
      )
  );
}
