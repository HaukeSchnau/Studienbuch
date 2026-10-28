import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

import { moduleExportName, unwrap } from "./syntax.ts";

type Identifier = Extract<ESTree.Node, { type: "Identifier" }>;

export interface Import {
  readonly module: string;
  /** The exported name, or `*` for a namespace or default import. */
  readonly name: string;
}

/** The variable `name` refers to at `node`, null for an undeclared global. */
export function resolve(context: Context, node: ESTree.Node, name: string): Variable | null {
  for (
    let scope: Scope | null = context.sourceCode.getScope(node);
    scope !== null;
    scope = scope.upper
  ) {
    const variable = scope.set.get(name);

    if (variable !== undefined) return variable;
  }

  return null;
}

/** Whether `node` names something imported, global or declared at module level: `Draft.reduce`. */
export function isModuleLevel(context: Context, node: ESTree.Node): boolean {
  let root = unwrap(node);

  while (root.type === "MemberExpression") root = unwrap(root.object);

  if (root.type !== "Identifier") return false;

  const scope = resolve(context, root, root.name)?.scope.type;

  return scope === undefined || scope === "module" || scope === "global";
}

/** What `identifier` was imported as, null for a local or a global. */
export function importOf(context: Context, identifier: Identifier): Import | null {
  const definition = resolve(context, identifier, identifier.name)?.defs[0];

  if (definition?.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
    return null;
  }

  const module = definition.parent.source.value;
  const specifier = definition.node;

  return specifier.type === "ImportSpecifier"
    ? { module, name: moduleExportName(specifier.imported) }
    : { module, name: "*" };
}

/** Whether `identifier` is `* as Effect from "effect/Effect"` or `{ Effect } from "effect"`. */
export function isEffectModule(context: Context, identifier: Identifier): boolean {
  const binding = importOf(context, identifier);

  return (
    (binding?.module === "effect/Effect" && binding.name === "*") ||
    (binding?.module === "effect" && binding.name === "Effect")
  );
}
