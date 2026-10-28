import * as NodePath from "node:path";

import { defineRule, type ESTree } from "@oxlint/plugins";

// A module is one PascalCase `.ts` file. Components (`.tsx`), tests (`X.test.ts`) and platform
// variants (`X.web.ts`) don't match.
const MODULE_FILE = /^(?<name>[A-Z][A-Za-z0-9]*)\.ts$/u;

function isRelative(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../");
}

/** Relative paths and workspace packages are our modules; everything else is a dependency. */
function isOwn(source: string): boolean {
  return isRelative(source) || source.startsWith("@stu/");
}

/** The namespace a module file exports itself as, or null when the import names no module file. */
function moduleName(source: string): string | null {
  if (!isRelative(source)) return null;

  return MODULE_FILE.exec(NodePath.posix.basename(source))?.groups?.name ?? null;
}

function nameOf(name: ESTree.ModuleExportName): string {
  return name.type === "Identifier" ? name.name : name.value;
}

/**
 * `X.ts` ends with `export * as X from "./X.ts"`, and callers write `import { X } from "./X.ts"`.
 * Our modules are never imported or re-exported as a namespace or member by member.
 */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Require the self-exporting module form and named imports of our own modules.",
    },
    messages: {
      missingSelfExport:
        '`{{name}}.ts` is a module. Export it as a namespace from inside itself: `export * as {{name}} from "./{{name}}.ts"`.',
      namespaceImport:
        'Import our own modules by name, as in `import { Homework } from "./Homework.ts"`. Namespace imports are for dependencies such as `effect/Effect`.',
      namespaceExport:
        'Re-export our own modules by name, as in `export { Homework } from "./Homework.ts"`. Only a module\'s own self-export uses `export * as`.',
      memberImport:
        "`{{name}}.ts` exports itself as `{{name}}`. Import `{ {{name}} }` and write `{{name}}.{{member}}`.",
    },
  },
  create(context) {
    const fileName = NodePath.basename(context.filename);
    const self = MODULE_FILE.exec(fileName)?.groups?.name;
    let selfExported = false;

    const checkMember = (source: string, member: string, node: ESTree.Node) => {
      const name = moduleName(source);

      if (name !== null && member !== name) {
        context.report({ node, messageId: "memberImport", data: { name, member } });
      }
    };

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        if (!isOwn(source)) return;

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            context.report({ node: specifier, messageId: "namespaceImport" });
          } else if (specifier.type === "ImportDefaultSpecifier") {
            checkMember(source, "default", specifier);
          } else {
            checkMember(source, nameOf(specifier.imported), specifier);
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source === null) return;

        for (const specifier of node.specifiers) {
          checkMember(node.source.value, nameOf(specifier.local), specifier);
        }
      },
      ExportAllDeclaration(node) {
        const source = node.source.value;

        if (!isOwn(source)) return;

        const isSelfExport =
          self !== undefined &&
          node.exported !== null &&
          nameOf(node.exported) === self &&
          source === `./${fileName}`;

        if (isSelfExport) {
          selfExported = true;
        } else {
          context.report({ node, messageId: "namespaceExport" });
        }
      },
      "Program:exit"(node) {
        if (self !== undefined && !selfExported) {
          context.report({ node, messageId: "missingSelfExport", data: { name: self } });
        }
      },
    };
  },
});
