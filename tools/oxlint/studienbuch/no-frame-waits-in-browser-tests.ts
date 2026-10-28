import { defineRule, type ESTree } from "@oxlint/plugins";

import { isFunction, memberKey, pathOf, propertyKey, staticString, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). The lint config scopes it to `*.browser.test.*` files.

const GLOBAL_OBJECTS = new Set(["globalThis", "self", "window"]);
const TIMERS = new Set(["setInterval", "setTimeout"]);
const EXECUTOR_WAITS = new Set(["requestAnimationFrame", "setTimeout", "setInterval"]);
const TRANSITION_EVENTS = new Set(["animationend", "transitionend"]);
const MOCK_FACTORIES = new Set(["vi.fn", "vi.spyOn", "vi.stubGlobal", "stubGlobal"]);
const MOCK_IMPLEMENTATIONS = new Set(["mockImplementation", "mockImplementationOnce"]);

/** `requestAnimationFrame` for a bare global or one read off `window`, `globalThis` or `self`. */
function globalName(node: ESTree.Node): string | null {
  const expression = unwrap(node);

  if (expression.type === "Identifier") return expression.name;

  if (expression.type !== "MemberExpression") return null;

  const object = unwrap(expression.object);

  return object.type === "Identifier" && GLOBAL_OBJECTS.has(object.name)
    ? memberKey(expression)
    : null;
}

function isMockingCall(node: ESTree.CallExpression): boolean {
  const callee = unwrap(node.callee);

  if (MOCK_FACTORIES.has(pathOf(callee) ?? "")) return true;

  return callee.type === "MemberExpression" && MOCK_IMPLEMENTATIONS.has(memberKey(callee) ?? "");
}

function isPromiseConstructor(node: ESTree.Node | null): node is ESTree.NewExpression {
  return node?.type === "NewExpression" && pathOf(node.callee) === "Promise";
}

// A frame call inside a mock is the fake's implementation, not the test waiting on a frame.
function isInsideMock(node: ESTree.Node): boolean {
  let child = node;

  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.type === "CallExpression" && current.callee !== child && isMockingCall(current)) {
      return true;
    }

    child = current;
  }

  return false;
}

function isInsidePromiseExecutor(node: ESTree.Node): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (
      isFunction(current) &&
      isPromiseConstructor(current.parent) &&
      current.parent.arguments[0] === current
    ) {
      return true;
    }
  }

  return false;
}

/** `fakeTimers({ toFake: [...] })` fakes only some timers, so the rest still race. */
function hasToFakeOption(argument: ESTree.Node | undefined): boolean {
  const expression = argument === undefined ? null : unwrap(argument);

  return (
    expression?.type === "ObjectExpression" &&
    expression.properties.some(
      (property) => property.type === "Property" && propertyKey(property) === "toFake",
    )
  );
}

function isTransitionEventListener(node: ESTree.CallExpression): boolean {
  const callee = unwrap(node.callee);
  const [event] = node.arguments;

  return (
    callee.type === "MemberExpression" &&
    memberKey(callee) === "addEventListener" &&
    event !== undefined &&
    TRANSITION_EVENTS.has(staticString(event) ?? "")
  );
}

function isFrameOrTimerWait(node: ESTree.CallExpression): boolean {
  const name = globalName(node.callee);

  if (name === "requestAnimationFrame") return !isInsideMock(node);

  if (name !== null && TIMERS.has(name)) return isInsidePromiseExecutor(node);

  return name === "fakeTimers" && hasToFakeOption(node.arguments[0]);
}

/** Browser tests wait for what the user sees, never for a frame, a transition or a real timer. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow waiting on animation frames, transitions, or real timers in browser tests, and partial fake-timer sets.",
    },
    messages: {
      frameWait:
        "Frame and transition waits race the renderer. Assert with `expect.element` or `vi.waitFor`, which retry, or install the full `fakeTimers()` set and advance the timer the component sets.",
    },
  },
  create(context) {
    return {
      NewExpression(node) {
        if (!isPromiseConstructor(node) || isInsideMock(node)) return;

        // `new Promise(setTimeout)` resolves on the next macrotask and
        // `new Promise(requestAnimationFrame)` on the next frame: the same waits, passed in.
        const [executor] = node.arguments;

        if (executor !== undefined && EXECUTOR_WAITS.has(globalName(executor) ?? "")) {
          context.report({ node: executor, messageId: "frameWait" });
        }
      },
      CallExpression(node) {
        if (
          isFrameOrTimerWait(node) ||
          pathOf(node.callee) === "vi.useFakeTimers" ||
          isTransitionEventListener(node)
        ) {
          context.report({ node: node.callee, messageId: "frameWait" });
        }
      },
    };
  },
});
