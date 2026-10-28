import { defineRule } from "@oxlint/plugins";

import { pathOf } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). T3 points at its own `observeResize`; React Native's `onLayout` does that job here.

const CONSTRUCTORS = new Set(
  ["", "globalThis.", "window.", "self."].map((prefix) => `${prefix}ResizeObserver`),
);

/** Client code measures with `onLayout`, which works on all three platforms. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow constructing ResizeObserver directly in client code; use `onLayout`.",
    },
    messages: {
      resizeObserver:
        "Measure with `onLayout`, which React Native implements on iOS, Android and the web. React Native 0.88 ships ResizeObserver only behind a feature flag that is off, and React commits state set in its callback after the paint, so derived layout lands a frame late.",
    },
  },
  create(context) {
    return {
      NewExpression(node) {
        if (CONSTRUCTORS.has(pathOf(node.callee) ?? "")) {
          context.report({ node: node.callee, messageId: "resizeObserver" });
        }
      },
    };
  },
});
