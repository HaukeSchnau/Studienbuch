import type { ESTree } from "@oxlint/plugins";

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

type LoopNode = ESTree.DoWhileStatement | ESTree.ForStatement | ESTree.WhileStatement;

const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);

const LOOPS = new Set(["DoWhileStatement", "ForStatement", "WhileStatement"]);

/** String literals are the `Literal` nodes written with quotes. */
export function isStringLiteral(node: ESTree.Node): node is ESTree.StringLiteral {
  return node.type === "Literal" && /^["']/u.test(node.raw ?? "");
}

export function isFunction(node: ESTree.Node): node is FunctionNode {
  return FUNCTIONS.has(node.type);
}

export function isLoop(node: ESTree.Node): node is LoopNode {
  return LOOPS.has(node.type);
}

/** The expression inside optional chains, parentheses, non-null assertions and type assertions. */
export function unwrap(node: ESTree.Node): ESTree.Node {
  let current = node;

  while (
    current.type === "ChainExpression" ||
    current.type === "ParenthesizedExpression" ||
    current.type === "TSNonNullExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSSatisfiesExpression" ||
    current.type === "TSTypeAssertion"
  ) {
    current = current.expression;
  }

  return current;
}

/** The key of `x.now` or `x["now"]`, null for a key computed at runtime. */
export function memberKey(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.name;

  return isStringLiteral(node.property) ? node.property.value : null;
}

/** The key of `{ now: … }` or `{ "now": … }`, null for a computed key. */
export function propertyKey(node: ESTree.ObjectProperty): string | null {
  if (node.key.type === "Identifier" && !node.computed) return node.key.name;

  return isStringLiteral(node.key) ? node.key.value : null;
}

/** `process.hrtime.bigint` for that member chain, null when any link isn't a plain name. */
export function pathOf(node: ESTree.Node): string | null {
  const expression = unwrap(node);

  if (expression.type === "Identifier") return expression.name;

  if (expression.type !== "MemberExpression") return null;

  const object = pathOf(expression.object);
  const key = memberKey(expression);

  return object === null || key === null ? null : `${object}.${key}`;
}
