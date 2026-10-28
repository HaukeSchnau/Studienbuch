import type { ESTree } from "@oxlint/plugins";

/** String literals are the `Literal` nodes written with quotes. */
export function isStringLiteral(node: ESTree.Node): node is ESTree.StringLiteral {
  return node.type === "Literal" && /^["']/u.test(node.raw ?? "");
}
