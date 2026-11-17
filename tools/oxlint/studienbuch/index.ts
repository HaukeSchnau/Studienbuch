import { definePlugin, type Rule } from "@oxlint/plugins";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import type { Scope } from "./scope.ts";

/** A file in rules/: the rule, and where it runs unless it runs everywhere. */
interface RuleModule {
  readonly default: Rule;
  readonly scope?: Scope;
}

const directory = new URL("rules/", import.meta.url);

// Each file in rules/ is one rule named after the file, so a new rule edits no shared file.
const modules = await Promise.all(
  NodeFS.readdirSync(directory)
    .filter((file) => file.endsWith(".ts"))
    .sort()
    .map(async (file) => {
      const module: RuleModule = await import(new URL(file, directory).href);

      return { name: NodePath.basename(file, ".ts"), ...module };
    }),
);

/** Studienbuch's own rules: the conventions in AGENTS.md that a linter can check. */
export default definePlugin({
  meta: { name: "studienbuch" },
  rules: Object.fromEntries(modules.map(({ name, default: rule }) => [name, rule])),
});

const error = (name: string) => [`studienbuch/${name}`, "error"] as const;

/** Every rule turned on where its `scope` says, for the lint section of vite.config.ts. */
export const enabled = {
  rules: Object.fromEntries(
    modules.flatMap(({ name, scope }) => (scope === undefined ? [error(name)] : [])),
  ),
  overrides: modules.flatMap(({ name, scope }) =>
    scope === undefined
      ? []
      : [
          {
            files: [...(scope.files ?? ["**/*"])],
            excludeFiles: [...(scope.excludeFiles ?? [])],
            rules: Object.fromEntries([error(name)]),
          },
        ],
  ),
};
