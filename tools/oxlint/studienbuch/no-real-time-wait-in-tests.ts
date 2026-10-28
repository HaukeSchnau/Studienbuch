import { defineRule, type ESTree } from "@oxlint/plugins";

import { isFunction, isLoop, memberKey, pathOf, propertyKey, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (pingdotgg/t3code, oxlint-plugin-t3code).

const TEST_CLOCK_DRIVERS = new Set(["TestClock.adjust", "TestClock.setTime"]);
const TIMER_PROMISES_MODULES = new Set(["node:timers/promises", "timers/promises"]);
const TIMER_FUNCTIONS = new Set(["setTimeout", "setInterval", "setImmediate"]);

const WAITS = new Set([
  "Effect.sleep",
  "Effect.delay",
  "Schedule.spaced",
  "Schedule.fixed",
  "Schedule.exponential",
]);

const TESTER_ROOTS = new Set(["it", "test"]);

/** The clock a test body runs on: `it.effect` has the TestClock, `it.live` and plain tests don't. */
type Tester = "effect" | "live" | "plain";

interface CalleeChain {
  readonly root: string;
  readonly members: ReadonlyArray<string>;
  readonly calls: ReadonlyArray<ESTree.CallExpression>;
}

/**
 * Flattens `it.live.skipIf(cond)` or `it.layer(L, options)` into the root name, the member names
 * in order, and the curried calls whose arguments carry options such as `excludeTestServices`.
 */
function calleeChain(callee: ESTree.Node): CalleeChain | null {
  const members: Array<string> = [];
  const calls: Array<ESTree.CallExpression> = [];
  let node = unwrap(callee);

  while (node.type === "CallExpression" || node.type === "MemberExpression") {
    if (node.type === "CallExpression") {
      calls.push(node);
      node = unwrap(node.callee);
    } else {
      const key = memberKey(node);

      if (key === null) return null;

      members.unshift(key);
      node = unwrap(node.object);
    }
  }

  return node.type === "Identifier" ? { root: node.name, members, calls } : null;
}

function isLayerBlock(chain: CalleeChain): boolean {
  return (
    chain.root === "layer" || (TESTER_ROOTS.has(chain.root) && chain.members.includes("layer"))
  );
}

function testerKind(chain: CalleeChain): Tester | null {
  if (!TESTER_ROOTS.has(chain.root) || chain.members.includes("layer")) return null;

  if (chain.members.includes("live") || chain.members.includes("scopedLive")) return "live";

  if (chain.members.includes("effect") || chain.members.includes("scoped")) return "effect";

  return "plain";
}

function excludesTestServices(chain: CalleeChain): boolean {
  return chain.calls.some((call) =>
    call.arguments.some((argument) => {
      const expression = unwrap(argument);

      return (
        expression.type === "ObjectExpression" &&
        expression.properties.some((property) => {
          if (property.type !== "Property" || propertyKey(property) !== "excludeTestServices") {
            return false;
          }

          const value = unwrap(property.value);

          return value.type === "Literal" && value.value === true;
        })
      );
    }),
  );
}

/**
 * The clock a call runs on. The nearest enclosing test decides, and an enclosing
 * `it.layer(_, { excludeTestServices: true })` takes the TestClock away from `it.effect`.
 */
function enclosingTester(node: ESTree.Node): Tester | null {
  let child = node;
  let current: ESTree.Node | null = node.parent;
  let tester: Tester | null = null;

  while (current !== null) {
    if (
      current.type === "CallExpression" &&
      current.arguments.some((argument) => argument === child)
    ) {
      const chain = calleeChain(current.callee);

      if (chain !== null) {
        if (tester === null) {
          tester = testerKind(chain);

          if (tester !== null && tester !== "effect") return tester;
        } else if (isLayerBlock(chain) && excludesTestServices(chain)) {
          return "live";
        }
      }
    }

    child = current;
    current = current.parent;
  }

  return tester;
}

/** `while (…) { yield* Effect.sleep(…) }`: a statement of the loop body, not a conditional delay. */
function isPollingLoopStep(node: ESTree.Node): boolean {
  let statement: ESTree.Node | null = node.parent;

  while (statement !== null && statement.type !== "ExpressionStatement") {
    if (isFunction(statement)) return false;

    statement = statement.parent;
  }

  const block = statement?.parent ?? null;

  if (block === null) return false;

  if (isLoop(block) || block.type === "ForInStatement" || block.type === "ForOfStatement") {
    return true;
  }

  const loop = block.type === "BlockStatement" ? block.parent : null;

  return (
    loop !== null &&
    (isLoop(loop) || loop.type === "ForInStatement" || loop.type === "ForOfStatement")
  );
}

function isInsidePromiseExecutor(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent;

  while (current !== null && !isFunction(current)) current = current.parent;

  const executor = current;
  const parent = executor?.parent ?? null;

  return (
    parent?.type === "NewExpression" &&
    parent.arguments[0] === executor &&
    pathOf(parent.callee) === "Promise"
  );
}

/** A test waits for the event that marks its milestone, or drives the TestClock. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow real-clock waits in tests; await the milestone or drive the TestClock instead.",
    },
    messages: {
      realClock:
        "Real-clock wait in a test. Await the `Deferred`, `Queue` or event that marks the milestone, or run under `it.effect` and `TestClock.adjust`. `it.live` is for subprocess and network fixtures, not for sleeping.",
      mixedClocks:
        "Real-clock wait in a test. `setTimeout` runs on the wall clock while `Effect.sleep` here runs on the TestClock, so they never meet. Await the milestone instead.",
      undrivenTestClock:
        "A sleep on the TestClock never ends without `TestClock.adjust`, so this test can only time out.",
    },
  },
  create(context) {
    let drivesTestClock = false;

    // Whether the file drives the TestClock is known only once the whole file is walked.
    const untilDriven: Array<{ node: ESTree.Node; messageId: "realClock" | "undrivenTestClock" }> =
      [];

    const timerPromiseLocals = new Set<string>();
    const timerPromiseNamespaces = new Set<string>();

    const isTimerPromiseCall = (callee: ESTree.Node) => {
      const expression = unwrap(callee);

      if (expression.type === "Identifier") return timerPromiseLocals.has(expression.name);

      if (expression.type !== "MemberExpression") return false;

      const object = unwrap(expression.object);

      return (
        object.type === "Identifier" &&
        timerPromiseNamespaces.has(object.name) &&
        TIMER_FUNCTIONS.has(memberKey(expression) ?? "")
      );
    };

    const isCallbackTimer = (callee: ESTree.Node) => {
      const expression = unwrap(callee);

      return (
        expression.type === "Identifier" &&
        TIMER_FUNCTIONS.has(expression.name) &&
        !timerPromiseLocals.has(expression.name)
      );
    };

    return {
      ImportDeclaration(node) {
        if (!TIMER_PROMISES_MODULES.has(node.source.value)) return;

        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            timerPromiseNamespaces.add(specifier.local.name);
          } else if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            TIMER_FUNCTIONS.has(specifier.imported.name)
          ) {
            timerPromiseLocals.add(specifier.local.name);
          }
        }
      },
      CallExpression(node) {
        if (
          isTimerPromiseCall(node.callee) ||
          (isCallbackTimer(node.callee) && isInsidePromiseExecutor(node))
        ) {
          context.report({
            node: node.callee,
            messageId: enclosingTester(node) === "effect" ? "mixedClocks" : "realClock",
          });

          return;
        }

        const path = pathOf(node.callee) ?? "";

        if (TEST_CLOCK_DRIVERS.has(path)) {
          drivesTestClock = true;

          return;
        }

        if (!WAITS.has(path)) return;

        const tester = enclosingTester(node);

        if (tester === null) {
          // A shared helper can serve TestClock tests. Report it when nothing in the file drives
          // the TestClock, or when it polls in a loop, which only a real clock ends.
          if (isPollingLoopStep(node)) {
            context.report({ node: node.callee, messageId: "realClock" });
          } else {
            untilDriven.push({ node: node.callee, messageId: "realClock" });
          }
        } else if (tester !== "effect") {
          context.report({ node: node.callee, messageId: "realClock" });
        } else if (path === "Effect.sleep") {
          untilDriven.push({ node: node.callee, messageId: "undrivenTestClock" });
        }
      },
      "Program:exit"() {
        if (drivesTestClock) return;

        for (const report of untilDriven) context.report(report);
      },
    };
  },
});
