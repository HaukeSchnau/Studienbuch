import { defineRule, type Comment } from "@oxlint/plugins";

const DIRECTIVE =
  /^\s*\*?\s*(?:(?:oxlint|eslint)-(?:disable|enable)|@ts-(?:expect-error|ignore|nocheck)|@effect-diagnostics)/u;

const TYPESCRIPT_DIRECTIVE = /^\s*\*?\s*@ts-(?:expect-error|ignore|nocheck)(?![\w-])(.*)$/su;
const EFFECT_DIRECTIVE = /^\s*\*?\s*@effect-diagnostics/u;
const BLANK_COMMENT = /^[\s*]*$/u;

/**
 * Every lint, type-checker or Effect diagnostics suppression says why: `-- reason` after an oxlint
 * directive, text after a `@ts-` directive, or a comment on the line above.
 */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Require every lint, type-checker or Effect diagnostics suppression to say why.",
    },
    messages: {
      lint: "Say why: end the directive with `-- reason` or put a comment on the line above.",
      typescript:
        "Say why: write the reason after the directive or in a comment on the line above.",
      effect: "Say why in a comment on the line above.",
    },
  },
  create(context) {
    const { sourceCode } = context;

    return {
      Program() {
        const comments = sourceCode.getAllComments();
        const ownLineCommentsByEndLine = new Map<number, Comment>();

        for (const comment of comments) {
          const { line, column } = comment.loc.start;

          if ((sourceCode.lines[line - 1] ?? "").slice(0, column).trim() === "") {
            ownLineCommentsByEndLine.set(comment.loc.end.line, comment);
          }
        }

        // Stacked directives share the explanation above the first of them.
        const explainedAbove = (directive: Comment) => {
          let above = ownLineCommentsByEndLine.get(directive.loc.start.line - 1);

          while (
            above !== undefined &&
            (DIRECTIVE.test(above.value) || BLANK_COMMENT.test(above.value))
          ) {
            above = ownLineCommentsByEndLine.get(above.loc.start.line - 1);
          }

          return above !== undefined;
        };

        for (const directive of sourceCode.getDisableDirectives().directives) {
          if (directive.type === "enable" || directive.justification.trim() !== "") continue;

          if (explainedAbove(directive.node)) continue;

          context.report({ loc: directive.node.loc, messageId: "lint" });
        }

        for (const comment of comments) {
          const afterTypeScriptDirective = TYPESCRIPT_DIRECTIVE.exec(comment.value)?.[1];

          if (afterTypeScriptDirective !== undefined) {
            if (afterTypeScriptDirective.replace(/^[\s:-]+/u, "").trim() !== "") continue;

            if (explainedAbove(comment)) continue;

            context.report({ loc: comment.loc, messageId: "typescript" });
          } else if (EFFECT_DIRECTIVE.test(comment.value) && !explainedAbove(comment)) {
            context.report({ loc: comment.loc, messageId: "effect" });
          }
        }
      },
    };
  },
});
