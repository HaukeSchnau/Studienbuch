import { defineRule, type ESTree } from "@oxlint/plugins";

import { isFunction, memberKey, moduleExportName, staticString, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). The lint config scopes it to component tests. T3's helper is apps/web/test/render.tsx. We
// write ours with the first component test, so any module named `render` counts.

const BROWSER_TEST = /\.browser\.test\.[cm]?[jt]sx?$/u;
const LIFECYCLE_HOOKS = new Set(["afterAll", "afterEach", "beforeAll", "beforeEach"]);
const TEST_RUNNERS = new Set(["@effect/vitest", "vite-plus/test", "vitest"]);
const REACT_ACT_EXPORTS = new Set(["act", "unstable_act"]);
const ACT_ENVIRONMENT = "IS_REACT_ACT_ENVIRONMENT";
const RENDER_HELPER = /(?:^|\/)render(?:\.tsx?)?$/u;
const LOCATOR_QUERY = /^getBy/u;

// Locator methods that dispatch real input through the browser provider.
const LOCATOR_INPUT = new Set([
  "clear",
  "click",
  "dblClick",
  "dropTo",
  "fill",
  "hover",
  "selectOptions",
  "tripleClick",
  "unhover",
  "upload",
]);

// These leave the locator for a DOM element, whose synthetic click() is fine inside act.
const LOCATOR_EXITS = new Set(["element", "elements", "query"]);

/** Whether a chain like `a.getByRole(…).first().click` builds a locator and never leaves it. */
function isLocatorChain(node: ESTree.Node): boolean {
  let sawQuery = false;

  for (let current = node; ;) {
    if (current.type === "CallExpression") {
      current = current.callee;
      continue;
    }

    if (current.type !== "MemberExpression") return sawQuery;

    const name = memberKey(current) ?? "";

    if (LOCATOR_EXITS.has(name)) return false;

    if (LOCATOR_QUERY.test(name)) sawQuery = true;

    current = current.object;
  }
}

/** `IS_REACT_ACT_ENVIRONMENT` or `globalThis.IS_REACT_ACT_ENVIRONMENT`. */
function namesActEnvironment(node: ESTree.Node): boolean {
  const target = unwrap(node);

  if (target.type === "Identifier") return target.name === ACT_ENVIRONMENT;

  return target.type === "MemberExpression" && memberKey(target) === ACT_ENVIRONMENT;
}

/** Component tests render through a disposable helper, not React roots and act by hand. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require component tests to render through the disposable render helper instead of managing React roots, act, or lifecycle hooks by hand.",
    },
    messages: {
      reactDomClient:
        "Render with `await using screen = await render(...)` from the render helper. It owns the React root and unmounts it on dispose.",
      reactAct:
        "Import `act` from the render helper. It turns on React's act environment only while act runs.",
      actEnvironment: `Leave ${ACT_ENVIRONMENT} to the render helper's act(), which sets it for exactly as long as it runs.`,
      actAroundInput:
        "Don't wrap real input (userEvent, or a locator's click or fill) in act. The browser runner flushes React updates after real input, so await the input directly.",
      lifecycleHook:
        "Acquire what a browser test needs with `using` or `await using` instead of lifecycle hooks, so nothing outlives the test that created it.",
    },
  },
  create(context) {
    const isBrowserTest = BROWSER_TEST.test(context.filename);
    // Local names bound to React's act or the render helper's act.
    const actNames = new Set<string>();
    const reactNamespaces = new Set<string>();
    const runnerNamespaces = new Set<string>();
    const userEventNames = new Set<string>();

    /** `act` for `React.act` when `React` is one of `namespaces`. */
    const namespaceMember = (node: ESTree.Node, namespaces: ReadonlySet<string>) =>
      node.type === "MemberExpression" &&
      node.object.type === "Identifier" &&
      namespaces.has(node.object.name)
        ? memberKey(node)
        : null;

    const isReactNamespaceAct = (callee: ESTree.Node) =>
      REACT_ACT_EXPORTS.has(namespaceMember(callee, reactNamespaces) ?? "");

    const isActCall = (node: ESTree.Node) =>
      node.type === "CallExpression" &&
      ((node.callee.type === "Identifier" && actNames.has(node.callee.name)) ||
        isReactNamespaceAct(node.callee));

    // A function defined inside act but not passed straight to a call may run after act settles.
    const isInsideAct = (node: ESTree.Node) => {
      for (let current = node.parent; current !== null; current = current.parent) {
        if (isActCall(current)) return true;

        const passedToCall =
          current.parent?.type === "CallExpression" &&
          current.parent.arguments.some((argument) => argument === current);

        if (isFunction(current) && !passedToCall) return false;
      }

      return false;
    };

    const isRealInput = (callee: ESTree.MemberExpression) => {
      if (callee.object.type === "Identifier" && userEventNames.has(callee.object.name)) {
        return true;
      }

      return LOCATOR_INPUT.has(memberKey(callee) ?? "") && isLocatorChain(callee.object);
    };

    const importFromRunner = (node: ESTree.ImportDeclaration) => {
      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportNamespaceSpecifier") {
          runnerNamespaces.add(specifier.local.name);
        } else if (
          specifier.type === "ImportSpecifier" &&
          LIFECYCLE_HOOKS.has(moduleExportName(specifier.imported))
        ) {
          context.report({ node: specifier, messageId: "lifecycleHook" });
        }
      }
    };

    const importFromReact = (node: ESTree.ImportDeclaration) => {
      for (const specifier of node.specifiers) {
        if (specifier.type !== "ImportSpecifier") {
          reactNamespaces.add(specifier.local.name);
        } else if (REACT_ACT_EXPORTS.has(moduleExportName(specifier.imported))) {
          actNames.add(specifier.local.name);
          context.report({ node: specifier, messageId: "reactAct" });
        }
      }
    };

    return {
      ImportDeclaration(node) {
        const source = node.source.value;

        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            moduleExportName(specifier.imported) === "userEvent"
          ) {
            userEventNames.add(specifier.local.name);
          }
        }

        if (isBrowserTest && TEST_RUNNERS.has(source)) importFromRunner(node);
        else if (RENDER_HELPER.test(source)) {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === "ImportSpecifier" &&
              moduleExportName(specifier.imported) === "act"
            ) {
              actNames.add(specifier.local.name);
            }
          }
        } else if (source === "react-dom/client") {
          context.report({ node: node.source, messageId: "reactDomClient" });
        } else if (source === "react") importFromReact(node);
      },
      AssignmentExpression(node) {
        if (namesActEnvironment(node.left)) {
          context.report({ node: node.left, messageId: "actEnvironment" });
        }
      },
      CallExpression(node) {
        const callee = unwrap(node.callee);

        if (callee.type === "Identifier") {
          if (isBrowserTest && LIFECYCLE_HOOKS.has(callee.name)) {
            context.report({ node: node.callee, messageId: "lifecycleHook" });
          }

          return;
        }

        if (callee.type !== "MemberExpression") return;

        const [first] = node.arguments;

        if (isReactNamespaceAct(callee)) {
          context.report({ node: node.callee, messageId: "reactAct" });
        } else if (
          isBrowserTest &&
          LIFECYCLE_HOOKS.has(namespaceMember(callee, runnerNamespaces) ?? "")
        ) {
          context.report({ node: node.callee, messageId: "lifecycleHook" });
        } else if (isRealInput(callee) && isInsideAct(node)) {
          context.report({ node, messageId: "actAroundInput" });
        } else if (
          // `vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)` leaves the flag on for the whole
          // test.
          memberKey(callee) === "stubGlobal" &&
          first !== undefined &&
          staticString(first) === ACT_ENVIRONMENT
        ) {
          context.report({ node, messageId: "actEnvironment" });
        }
      },
    };
  },
});
