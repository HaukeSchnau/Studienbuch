import * as NodePath from "node:path";

import { defineRule, type ESTree } from "@oxlint/plugins";

import { isStringLiteral } from "./syntax.ts";

// Entries that hand out test doubles. `@stu/e2ee/testing` draws "random" bytes from a fixed
// stream, so production code that imported it would seal with predictable nonces and keys.
const TEST_ONLY = new Set(["@stu/e2ee/testing"]);

const TEST_FILE = /\.(?:test|spec)\.tsx?$|\.setup\.ts$/u;

// `@stu/sync/testing` is test code too: the simulation and its helpers, which only tests import.
const TEST_ENTRY = /\/packages\/sync\/src\/(?:testing\.ts$|testing\/|simulation\/)/u;

// The simulation runs devices on `@stu/e2ee/testing`, so a relative import of it brings that along.
const SIMULATION = /\/packages\/sync\/src\/simulation\//u;

/** Test doubles stay in tests. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Allow test-only entries such as `@stu/e2ee/testing`, and the sync simulation, in test files and `@stu/sync/testing` only.",
    },
    messages: {
      testOnly:
        "`{{source}}` is for tests only. Production code takes the real layer, such as `CryptoSuite.layer`.",
    },
  },
  create(context) {
    if (TEST_FILE.test(context.filename) || TEST_ENTRY.test(context.filename)) return {};
    const directory = NodePath.dirname(context.filename);

    const testOnly = (source: string) =>
      TEST_ONLY.has(source) ||
      (source.startsWith(".") && SIMULATION.test(NodePath.join(directory, source)));

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
