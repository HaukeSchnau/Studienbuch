import * as NodePath from "node:path";

import type { Context } from "@oxlint/plugins";

// Fixtures pretend to live at the path below this directory, so path-scoped rules treat
// `tools/oxlint/fixtures/packages/core/X.ts` like `packages/core/X.ts`.
const FIXTURES = "tools/oxlint/fixtures/";

// This file sits in tools/oxlint/studienbuch/, so the paths stay the same when lint runs from a
// package's directory.
const ROOT = NodePath.resolve(import.meta.dirname, "../../..");

/** The linted file's path relative to the repository root, with forward slashes. */
export function repositoryPath(context: Context): string {
  return NodePath.relative(ROOT, context.filename).split(NodePath.sep).join("/");
}

/** The path a rule scoped to parts of the repository matches against. */
export function layoutPath(context: Context): string {
  const path = repositoryPath(context);

  return path.startsWith(FIXTURES) ? path.slice(FIXTURES.length) : path;
}
