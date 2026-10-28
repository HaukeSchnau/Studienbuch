import { defineRule } from "@oxlint/plugins";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.).

const MODULE_ALIASES = new Map([
  ["assert/strict", "Assert"],
  ["fs/promises", "FSP"],
]);

const SEGMENT_ALIASES = new Map([
  ["fs", "FS"],
  ["os", "OS"],
  ["url", "URL"],
  ["vm", "VM"],
]);

const pascalCase = (value: string) =>
  value
    .split(/[_-]/u)
    .filter((segment) => segment !== "")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");

/** `NodeFSP` for `node:fs/promises`, `NodeChildProcess` for `node:child_process`. */
function namespaceFor(source: string): string {
  const name = source.slice("node:".length);
  const alias = MODULE_ALIASES.get(name);

  if (alias !== undefined) return `Node${alias}`;

  return `Node${name
    .split("/")
    .map((segment) => SEGMENT_ALIASES.get(segment) ?? pascalCase(segment))
    .join("")}`;
}

/** Node built-ins read the same everywhere: `NodePath.join`, never a bare `join`. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require canonical namespace imports for Node.js built-in modules.",
    },
    messages: {
      namespace: "Import {{source}} as a namespace named {{namespace}}.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        if (!source.startsWith("node:")) return;

        const namespace = namespaceFor(source);
        const [specifier] = node.specifiers;

        if (
          node.specifiers.length === 1 &&
          specifier?.type === "ImportNamespaceSpecifier" &&
          specifier.local.name === namespace
        ) {
          return;
        }

        context.report({ node, messageId: "namespace", data: { source, namespace } });
      },
    };
  },
});
