import { defineRule, type ESTree } from "@oxlint/plugins";

import { isStringLiteral } from "./syntax.ts";

// Entries that hand out test doubles. `@stu/e2ee/testing` draws "random" bytes from a fixed
// stream, so production code that imported it would seal with predictable nonces and keys.
const TEST_ONLY = new Set(["@stu/e2ee/testing"]);

const TEST_FILE = /\.(?:test|spec)\.tsx?$|\.setup\.ts$/u;

/** Test doubles stay in tests. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Allow test-only entries such as `@stu/e2ee/testing` in test files only.",
    },
    messages: {
      testOnly:
        "`{{source}}` is for tests only. Production code takes the real layer, such as `CryptoSuite.layer`.",
    },
  },
  create(context) {
    if (TEST_FILE.test(context.filename)) return {};

    const check = (source: ESTree.Node) => {
      if (isStringLiteral(source) && TEST_ONLY.has(source.value)) {
        context.report({ node: source, messageId: "testOnly", data: { source: source.value } });
      }
    };

    return {
      ImportDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => {
        if (node.source !== null) check(node.source);
      },
    };
  },
});
