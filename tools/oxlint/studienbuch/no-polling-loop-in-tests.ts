import { defineRule, type ESTree } from "@oxlint/plugins";

import { isFunction, isLoop, pathOf, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (pingdotgg/t3code, oxlint-plugin-t3code). T3 searches
// each loop's body for waits and exits. This walks up from them instead, so it needs no traversal
// over a node's untyped fields, and decides once the whole file is seen.

const COUNTER_OPERATORS = new Set(["<", "<=", ">", ">="]);
const TIMERS = new Set(["setImmediate", "setTimeout"]);

type LoopNode = ESTree.DoWhileStatement | ESTree.ForStatement | ESTree.WhileStatement;

/**
 * The loops whose body holds `node`, nearest first, up to the enclosing function. With
 * `withUpdate`, a for loop's update counts as part of it.
 */
function enclosingLoops(node: ESTree.Node, withUpdate: boolean): Array<LoopNode> {
  const loops: Array<LoopNode> = [];
  let child = node;
  let current: ESTree.Node | null = node.parent;

  while (current !== null && !isFunction(current)) {
    if (
      isLoop(current) &&
      (current.body === child ||
        (withUpdate && current.type === "ForStatement" && current.update === child))
    ) {
      loops.push(current);
    }

    child = current;
    current = current.parent;
  }

  return loops;
}

/** The loops a `return`, `break` or `throw` inside an `if` can end. */
function conditionallyExitedLoops(node: ESTree.Node): Array<LoopNode> {
  const loops: Array<LoopNode> = [];
  let insideIf = false;
  let child = node;
  let current: ESTree.Node | null = node.parent;

  while (current !== null && !isFunction(current)) {
    if (
      current.type === "IfStatement" &&
      (current.consequent === child || current.alternate === child)
    ) {
      insideIf = true;
    }

    if (insideIf && isLoop(current) && current.body === child) loops.push(current);

    child = current;
    current = current.parent;
  }

  return loops;
}

function isTrueLiteral(node: ESTree.Node): boolean {
  const expression = unwrap(node);

  return expression.type === "Literal" && expression.value === true;
}

function isNumericBound(node: ESTree.Node): boolean {
  const expression = unwrap(node);

  return (
    expression.type === "Identifier" ||
    (expression.type === "Literal" && Number.isFinite(expression.value))
  );
}

/** Loops in tests wait for a milestone event, never spin until a predicate holds. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow loops in tests that spin on yieldNow, sleep or timer ticks until a predicate holds.",
    },
    messages: {
      polling:
        "Polling loop in a test. Spinning on `yieldNow` or `sleep` depends on the scheduler and the runner's load. Await the `Deferred`, `Queue.take`, `Stream` element or drain that marks the milestone.",
    },
  },
  create(context) {
    const candidates: Array<ESTree.Node> = [];
    // Promise executors that schedule a timer, so `new Promise(…)` with them is a tick.
    const timerExecutors = new Set<ESTree.Node>();
    const exitingLoops = new Set<LoopNode>();
    const counters = new Map<LoopNode, Set<string>>();

    /** `Promise.resolve()`, or a `new Promise` whose executor is a timer or schedules one. */
    const isTickPromise = (node: ESTree.Node): boolean => {
      const expression = unwrap(node);

      if (expression.type === "CallExpression") {
        return pathOf(expression.callee) === "Promise.resolve";
      }

      if (expression.type !== "NewExpression" || pathOf(expression.callee) !== "Promise") {
        return false;
      }

      const [executor] = expression.arguments;

      return (
        executor !== undefined &&
        (TIMERS.has(pathOf(executor) ?? "") || timerExecutors.has(executor))
      );
    };

    const thunkReturnsTick = (node: ESTree.Node | undefined): boolean => {
      if (node?.type !== "ArrowFunctionExpression") return false;

      if (node.body.type !== "BlockStatement") return isTickPromise(node.body);

      const last = node.body.body.at(-1);

      return (
        last?.type === "ReturnStatement" && last.argument !== null && isTickPromise(last.argument)
      );
    };

    const isWait = (node: ESTree.Node): boolean => {
      if (node.type === "MemberExpression") return pathOf(node) === "Effect.yieldNow";

      if (node.type === "AwaitExpression") return isTickPromise(node.argument);

      if (node.type === "NewExpression") return isTickPromise(node);

      if (node.type !== "CallExpression") return false;

      const path = pathOf(node.callee);

      return (
        path === "Effect.sleep" ||
        path === "setImmediate" ||
        (path === "Effect.promise" && thunkReturnsTick(node.arguments[0]))
      );
    };

    // A bare counter (`i < 3`, `attempt < max`) that the loop itself advances bounds the loop
    // without asking the system under test anything. `events.length < 1` is a predicate.
    const isCounterTest = (loop: LoopNode) => {
      const test = loop.test === null ? null : unwrap(loop.test);

      if (test?.type !== "BinaryExpression" || !COUNTER_OPERATORS.has(test.operator)) return false;

      const advanced = counters.get(loop) ?? new Set<string>();

      return [
        [test.left, test.right],
        [test.right, test.left],
      ].some(([counter, bound]) => {
        const name = counter === undefined ? null : unwrap(counter);

        return (
          name?.type === "Identifier" &&
          advanced.has(name.name) &&
          bound !== undefined &&
          isNumericBound(bound)
        );
      });
    };

    const countUpdate = (target: ESTree.Node, node: ESTree.Node) => {
      const name = unwrap(target);

      if (name.type !== "Identifier") return;

      for (const loop of enclosingLoops(node, true)) {
        counters.set(loop, (counters.get(loop) ?? new Set<string>()).add(name.name));
      }
    };

    const markExit = (node: ESTree.Node) => {
      for (const loop of conditionallyExitedLoops(node)) exitingLoops.add(loop);
    };

    return {
      MemberExpression(node) {
        candidates.push(node);
      },
      AwaitExpression(node) {
        candidates.push(node);
      },
      NewExpression(node) {
        candidates.push(node);
      },
      CallExpression(node) {
        candidates.push(node);

        if (!TIMERS.has(pathOf(node.callee) ?? "")) return;

        let current: ESTree.Node | null = node.parent;

        while (current !== null && !isFunction(current)) current = current.parent;

        if (current !== null) timerExecutors.add(current);
      },
      ReturnStatement: markExit,
      BreakStatement: markExit,
      ThrowStatement: markExit,
      UpdateExpression(node) {
        countUpdate(node.argument, node);
      },
      AssignmentExpression(node) {
        if (node.operator === "+=" || node.operator === "-=") countUpdate(node.left, node);
      },
      "Program:exit"() {
        const waitingLoops = new Set<LoopNode>();

        for (const candidate of candidates) {
          if (!isWait(candidate)) continue;

          for (const loop of enclosingLoops(candidate, false)) waitingLoops.add(loop);
        }

        // A loop polls when a predicate decides whether it goes on: a conditional exit in its
        // body, or a test that is neither `true` nor a counter the loop advances.
        for (const loop of waitingLoops) {
          const predicateTest =
            loop.test !== null && !isTrueLiteral(loop.test) && !isCounterTest(loop);

          if (exitingLoops.has(loop) || predicateTest) {
            context.report({ node: loop, messageId: "polling" });
          }
        }
      },
    };
  },
});
