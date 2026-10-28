import { defineRule, type ESTree } from "@oxlint/plugins";

import { memberKey, pathOf, propertyKey, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (pingdotgg/t3code, oxlint-plugin-t3code). T3 asks
// for a GitHub issue in the quarantine comment; here the comment needs a reason.

const TEST_FUNCTIONS = new Set(["describe", "it", "suite", "test"]);
const HOOK_FUNCTIONS = new Set(["afterAll", "afterEach", "beforeAll", "beforeEach"]);
const FOCUS_OR_SKIP_MODIFIERS = new Set(["only", "skip", "todo"]);
const FOCUS_OR_SKIP_FUNCTIONS = new Set(["fdescribe", "fit", "xdescribe", "xit", "xtest"]);
const TIMEOUT_OPTIONS = new Set(["retry", "timeout"]);
const SET_CONFIG_OPTIONS = new Set(["hookTimeout", "retry", "testTimeout"]);
const QUARANTINE = /quarantine:\s*\S/u;
const STATEMENT = /(?:Statement|Declaration)$/u;

/** `it` for `it.effect.each(cases)`, `describe.skipIf(x)` or `it.layer(L)`. */
function chainRoot(node: ESTree.Node): string | null {
  const expression = unwrap(node);

  if (expression.type === "Identifier") return expression.name;

  if (expression.type === "MemberExpression") return chainRoot(expression.object);

  if (expression.type === "CallExpression") return chainRoot(expression.callee);

  return null;
}

function isTestChain(node: ESTree.Node): boolean {
  return TEST_FUNCTIONS.has(chainRoot(node) ?? "");
}

/** The properties of an object literal argument whose key is one of `names`. */
function options(node: ESTree.Node | undefined, names: ReadonlySet<string>) {
  const expression = node === undefined ? null : unwrap(node);

  if (expression?.type !== "ObjectExpression") return [];

  return expression.properties.filter(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" && names.has(propertyKey(property) ?? ""),
  );
}

function hasOption(node: ESTree.Node | undefined, names: ReadonlySet<string>): boolean {
  return options(node, names).length > 0;
}

// `{ skip: windowsHost }` is a platform gate like `skipIf` and stays allowed; `{ skip: true }`
// is `it.skip`.
function hasEnabledOption(node: ESTree.Node | undefined, names: ReadonlySet<string>): boolean {
  return options(node, names).some((property) => {
    const value = unwrap(property.value);

    return value.type === "Literal" && value.value === true;
  });
}

function isNumericLiteral(node: ESTree.Node | undefined): boolean {
  const expression = node === undefined ? null : unwrap(node);

  return expression?.type === "Literal" && Number.isFinite(expression.value);
}

function enclosingStatement(node: ESTree.Node): ESTree.Node {
  let current = node;

  while (current.parent !== null && !STATEMENT.test(current.type)) current = current.parent;

  return current;
}

/** Tests wait on events, never on a longer timeout or another try, and a skipped test says why. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow per-test timeouts and retries, and require a reason for skipped or focused tests.",
    },
    messages: {
      timeout:
        "Per-test timeouts and retries hide waits that should be event-driven; the project timeout is the ceiling. Remove the override and await the milestone.",
      skip: "A skipped or focused test needs a reason in the comment above it: `// quarantine: <why>`.",
    },
  },
  create(context) {
    const reportUnlessQuarantined = (node: ESTree.Node) => {
      const comments = context.sourceCode.getCommentsBefore(enclosingStatement(node));

      if (!comments.some((comment) => QUARANTINE.test(comment.value))) {
        context.report({ node, messageId: "skip" });
      }
    };

    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);

        if (callee.type === "MemberExpression" && pathOf(callee) === "vi.setConfig") {
          if (hasOption(node.arguments[0], SET_CONFIG_OPTIONS)) {
            context.report({ node, messageId: "timeout" });
          }

          return;
        }

        if (callee.type === "Identifier" && HOOK_FUNCTIONS.has(callee.name)) {
          if (isNumericLiteral(node.arguments[1])) context.report({ node, messageId: "timeout" });

          return;
        }

        if (!isTestChain(callee)) return;

        const [, second, third] = node.arguments;

        // `test(name, { timeout }, fn)` is the options-first spelling of the same override.
        if (
          isNumericLiteral(third) ||
          hasOption(third, TIMEOUT_OPTIONS) ||
          hasOption(second, TIMEOUT_OPTIONS)
        ) {
          context.report({ node, messageId: "timeout" });
        }

        if (
          hasEnabledOption(second, FOCUS_OR_SKIP_MODIFIERS) ||
          hasEnabledOption(third, FOCUS_OR_SKIP_MODIFIERS)
        ) {
          reportUnlessQuarantined(node);
        }
      },
      Identifier(node) {
        const { parent } = node;

        if (
          FOCUS_OR_SKIP_FUNCTIONS.has(node.name) &&
          parent.type === "CallExpression" &&
          parent.callee === node
        ) {
          reportUnlessQuarantined(node);
        }
      },
      MemberExpression(node) {
        // `it["skip"](…)` registers the same way as `it.skip(…)`.
        if (FOCUS_OR_SKIP_MODIFIERS.has(memberKey(node) ?? "") && isTestChain(node.object)) {
          reportUnlessQuarantined(node);
        }
      },
    };
  },
});
