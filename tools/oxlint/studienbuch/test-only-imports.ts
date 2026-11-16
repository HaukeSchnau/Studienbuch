import * as NodePath from "node:path";

import { defineRule, type ESTree } from "@oxlint/plugins";

import { layoutPath } from "./repository-path.ts";
import { isStringLiteral } from "./syntax.ts";

// Entries that hand out test doubles. `@stu/e2ee/testing` draws "random" bytes from a fixed
// stream, so production code that imported it would seal with predictable nonces and keys.
// `@stu/sync/testing` reads Vitest's context as it loads.
const TEST_ENTRY = /^@stu\/[^/]+\/testing(?:\/|$)/u;

const TEST_FILE = /\.(?:test|spec)\.tsx?$|\.(?:setup|bench)\.ts$/u;

// Test machinery by its path: sync's `testing/` and its simulation, which runs devices on
// `@stu/e2ee/testing`, and any `<Name>Testing.ts` module. A module that imports one has to be one
// too, so a chain of imports from production code into test code breaks at its first link. e2ee's
// own `testing/` stays out: the vectors that the self-test ships run on its `TestCrypto`.
const TEST_MACHINERY =
  /^packages\/sync\/src\/(?:testing\.ts$|testing\/|simulation\/)|\/[A-Z][A-Za-z\d]*Testing\.tsx?$/u;

/** Test doubles stay in tests. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Allow test machinery, such as `@stu/e2ee/testing`, sync's `testing/` or a `<Name>Testing.ts` module, in test files and other test machinery only.",
    },
    messages: {
      testOnly:
        "`{{source}}` is for tests only. Production code takes the real layer, such as `CryptoSuite.layer`. A helper that tests share goes in a `<Name>Testing.ts` module.",
    },
  },
  create(context) {
    const file = layoutPath(context);

    if (TEST_FILE.test(file) || TEST_MACHINERY.test(file)) return {};
    const directory = NodePath.posix.dirname(file);

    const testOnly = (source: string) =>
      TEST_ENTRY.test(source) ||
      (source.startsWith(".") && TEST_MACHINERY.test(NodePath.posix.join(directory, source)));

    const check = (source: ESTree.Node) => {
      if (isStringLiteral(source) && testOnly(source.value)) {
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
