import * as NodePath from "node:path";

import { defineRule, type ESTree } from "@oxlint/plugins";

import { layoutPath } from "./repository-path.ts";
import { staticString } from "./syntax.ts";

// Entries that hand out test doubles. `@stu/e2ee/testing` draws "random" bytes from a fixed
// stream, so production code that imported it would seal with predictable nonces and keys.
// `@stu/sync/testing` reads Vitest's context as it loads.
const TEST_ENTRY = /^@stu\/[^/]+\/testing(?:\/|$)/u;

const TEST_FILE = /\.(?:test|spec)\.tsx?$|\.(?:setup|bench)\.ts$/u;

// Test machinery by its repository path: a package's `testing/` and `testing.ts`, and sync's
// simulation, which runs devices on `@stu/e2ee/testing`. A module that imports one has to be test
// machinery too, so a chain of imports from production code into test code breaks at its first link.
const TEST_DIRECTORY =
  /^packages\/[^/]+\/src\/(?:testing\.ts$|testing\/)|^packages\/sync\/src\/simulation\//u;

// A helper that tests share, by its file name or by any specifier that names it, an alias included.
const TESTING_MODULE = /(?:^|\/)[A-Z][A-Za-z\d]*Testing(?:\.tsx?)?$/u;

/** Test doubles stay in tests. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Allow test machinery, such as `@stu/e2ee/testing`, a package's `testing/` or a `<Name>Testing.ts` module, in test files and other test machinery only.",
    },
    messages: {
      testOnly:
        "`{{source}}` is for tests only. Production code takes the real layer, such as `CryptoSuite.layer`. A helper that tests share goes in a `<Name>Testing.ts` module.",
    },
  },
  create(context) {
    const file = layoutPath(context);

    if (TEST_FILE.test(file) || TEST_DIRECTORY.test(file) || TESTING_MODULE.test(file)) return {};
    const directory = NodePath.posix.dirname(file);

    const testOnly = (source: string) =>
      TEST_ENTRY.test(source) ||
      TESTING_MODULE.test(source) ||
      (source.startsWith(".") && TEST_DIRECTORY.test(NodePath.posix.join(directory, source)));

    const check = (node: ESTree.Node) => {
      const source = staticString(node);

      if (source !== null && testOnly(source)) {
        context.report({ node, messageId: "testOnly", data: { source } });
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
