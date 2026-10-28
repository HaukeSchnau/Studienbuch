import { defineRule } from "@oxlint/plugins";

import { repositoryPath } from "./repository-path.ts";

// These name a kind of file, so they attract anything without an obvious home (AGENTS.md,
// "Directory naming").
const FILE_KINDS = new Set(["lib", "utils", "helpers", "common", "shared", "misc", "types"]);

/** A directory name says why its code exists, never what kind of file it holds. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow directories named for a kind of file, such as `utils` or `types`.",
    },
    messages: {
      fileKind:
        "`{{directory}}/` names a kind of file, not a reason to exist. Name the directory for the domain question it answers or the technology it adapts.",
    },
  },
  create(context) {
    return {
      Program(node) {
        const directory = repositoryPath(context)
          .split("/")
          .slice(0, -1)
          .find((name) => FILE_KINDS.has(name));

        if (directory !== undefined) {
          context.report({ node, messageId: "fileKind", data: { directory } });
        }
      },
    };
  },
});
