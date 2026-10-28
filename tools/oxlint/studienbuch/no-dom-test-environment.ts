import { defineRule, type ESTree } from "@oxlint/plugins";

import { staticString } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.).

const DOM_EMULATOR = /^(?:jsdom|happy-dom)(?:\/|$)/u;

/** A test runs where its code runs: Node for logic, a real browser for the DOM. */
export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Reject per-file Vitest environments and DOM emulator imports." },
    messages: {
      domEnvironment:
        "Set the test environment in the Vitest project config, not per file, and don't emulate the DOM. jsdom and happy-dom pass what a real browser fails, so DOM tests run in a browser as `*.browser.test.tsx`.",
    },
  },
  create(context) {
    const check = (source: ESTree.Node | null | undefined) => {
      if (source === null || source === undefined) return;

      if (DOM_EMULATOR.test(staticString(source) ?? "")) {
        context.report({ node: source, messageId: "domEnvironment" });
      }
    };

    return {
      Program() {
        const index = context.sourceCode.text.indexOf("@vitest-environment");

        if (index !== -1) {
          context.report({
            loc: context.sourceCode.getLocFromIndex(index),
            messageId: "domEnvironment",
          });
        }
      },
      ImportDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      TSExternalModuleReference: (node) => check(node.expression),
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require") {
          check(node.arguments[0]);
        }
      },
    };
  },
});
