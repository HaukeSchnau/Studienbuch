import * as NodePath from "node:path";

import { defineRule, type ESTree } from "@oxlint/plugins";

import { app } from "./boundaries/app.ts";
import type { Boundary } from "./boundaries/boundary.ts";
import { everywhere } from "./boundaries/everywhere.ts";
import { packages } from "./boundaries/packages.ts";
import { server } from "./boundaries/server.ts";
import { layoutPath } from "./repository-path.ts";
import { moduleExportName, staticString } from "./syntax.ts";

// AGENTS.md, "Where code lives", one file per part of the repository.
const BOUNDARIES: ReadonlyArray<Boundary> = [...everywhere, ...packages, ...server, ...app];

// A workspace package is a directory right below apps/ or packages/.
const PACKAGE = /^(?:apps|packages)\/[^/]+/u;

// A namespace or default import reaches every name of a module, the forbidden ones included.
const WHOLE_MODULE = new Set(["*", "default"]);

function isRelative(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../");
}

/** Code imports only what its place in the repository allows. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Enforce the import boundaries between packages and app directories.",
    },
    messages: {
      forbidden: "`{{source}}` is out of bounds here. {{reason}}",
      forbiddenName: "`{{name}}` from `{{source}}` is out of bounds here. {{reason}}",
      otherPackage:
        "`{{source}}` leaves `{{package}}`. Import another package by its name, such as `@stu/core`, so its package.json declares the dependency and its exports decide what is public.",
    },
  },
  create(context) {
    const file = layoutPath(context);
    const ownPackage = PACKAGE.exec(file)?.[0] ?? null;

    const boundaries = BOUNDARIES.filter((boundary) =>
      boundary.files.some((glob) => NodePath.matchesGlob(file, glob)),
    );

    if (boundaries.length === 0 && ownPackage === null) return {};

    const directory = NodePath.posix.dirname(file);

    /** This file's package when the relative `source` reaches outside it, else null. */
    const packageLeft = (source: string) =>
      ownPackage !== null &&
      isRelative(source) &&
      !NodePath.posix.join(directory, source).startsWith(`${ownPackage}/`)
        ? ownPackage
        : null;

    /** The specifier, plus the repository path of a relative import. */
    const targets = (source: string) =>
      isRelative(source) ? [source, NodePath.posix.join(directory, source)] : [source];

    const crossing = (source: string) => {
      const candidates = targets(source);

      return boundaries.filter((boundary) =>
        boundary.forbidden.some((glob) =>
          candidates.some((candidate) => NodePath.matchesGlob(candidate, glob)),
        ),
      );
    };

    /**
     * Reports what `source` gives this file: named bindings, `default`, or `*` for all of it. An
     * import that crosses several boundaries fails once, with the first one it crosses.
     */
    const check = (
      source: string,
      node: ESTree.Node,
      names: ReadonlyArray<{ readonly name: string; readonly node: ESTree.Node }>,
    ) => {
      const left = packageLeft(source);

      if (left !== null) {
        context.report({ node, messageId: "otherPackage", data: { source, package: left } });

        return;
      }

      const crossed = crossing(source);
      const whole = crossed.find((boundary) => boundary.names === undefined);

      if (whole !== undefined) {
        context.report({ node, messageId: "forbidden", data: { source, reason: whole.reason } });

        return;
      }

      for (const imported of names) {
        const boundary = crossed.find(
          (candidate) =>
            WHOLE_MODULE.has(imported.name) || candidate.names?.includes(imported.name) === true,
        );

        if (boundary !== undefined) {
          context.report({
            node: imported.node,
            messageId: "forbiddenName",
            data: { name: imported.name, source, reason: boundary.reason },
          });
        }
      }
    };

    return {
      ImportDeclaration(node) {
        check(
          node.source.value,
          node.source,
          node.specifiers.map((specifier) => ({
            name:
              specifier.type === "ImportSpecifier"
                ? moduleExportName(specifier.imported)
                : specifier.type === "ImportDefaultSpecifier"
                  ? "default"
                  : "*",
            node: specifier,
          })),
        );
      },
      ExportNamedDeclaration(node) {
        if (node.source === null) return;

        check(
          node.source.value,
          node.source,
          node.specifiers.map((specifier) => ({
            name: moduleExportName(specifier.local),
            node: specifier,
          })),
        );
      },
      ExportAllDeclaration(node) {
        check(node.source.value, node.source, [{ name: "*", node }]);
      },
      ImportExpression(node) {
        const source = staticString(node.source);

        if (source !== null) check(source, node.source, [{ name: "*", node }]);
      },
    };
  },
});
