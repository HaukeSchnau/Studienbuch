import * as NodePath from "node:path";

import type { Context } from "@oxlint/plugins";

// Fixtures pretend to live at the path below this directory, so path-scoped rules treat
// `tools/oxlint/fixtures/packages/core/X.ts` like `packages/core/X.ts`.
const FIXTURES = "tools/oxlint/fixtures/";

/** The linted file's path relative to the directory oxlint runs in, with forward slashes. */
export function repositoryPath(context: Context): string {
  return NodePath.relative(context.cwd, context.filename).split(NodePath.sep).join("/");
}

/** The path a rule scoped to parts of the repository matches against. */
export function layoutPath(context: Context): string {
  const path = repositoryPath(context);

  return path.startsWith(FIXTURES) ? path.slice(FIXTURES.length) : path;
}
