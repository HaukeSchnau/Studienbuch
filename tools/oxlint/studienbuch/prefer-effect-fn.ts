import { defineRule, type ESTree } from "@oxlint/plugins";

import { importOf, isEffectModule } from "./bindings.ts";
import { type FunctionNode, propertyKey } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). `studienbuch/effect-fn-name` then checks the span name.

// Callbacks in these calls are inline programs, not reusable functions.
const INLINE_CALLBACK_CALLS = new Set(["catchTags", "match", "matchEffect", "matchCauseEffect"]);

/** Whether `object` is the literal passed to `match(…, { … })`, `catchTags({ … })` and the like. */
function isInlineCallbacks(object: ESTree.Node, key: string | null): boolean {
  const call = object.parent;

  if (call?.type !== "CallExpression") return false;

  let callee = call.callee;

  while (callee.type === "CallExpression") callee = callee.callee;

  if (callee.type !== "MemberExpression" || callee.computed) return false;

  const name = callee.property.name;

  return INLINE_CALLBACK_CALLS.has(name) || (key === "defaultValue" && name === "Reference");
}

/** A function that only runs an Effect generator is `Effect.fn`, which gives it a span. */
export default defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Use Effect.fn for reusable generator-based Effect functions.",
    },
    messages: {
      effectFn:
        'Use Effect.fn("Service.operation") for reusable Effect functions. Reserve Effect.fnUntraced for documented hot paths or an existing span, and keep Effect.gen for inline programs.',
    },
  },
  create(context) {
    const isGeneratorCall = (expression: ESTree.Node): boolean => {
      if (expression.type !== "CallExpression") return false;

      const { callee } = expression;

      if (callee.type === "Identifier") {
        const binding = importOf(context, callee);

        return binding?.module === "effect/Effect" && binding.name === "gen";
      }

      if (callee.type !== "MemberExpression" || callee.computed) return false;

      if (callee.property.name === "pipe") return isGeneratorCall(callee.object);

      return (
        callee.property.name === "gen" &&
        callee.object.type === "Identifier" &&
        isEffectModule(context, callee.object)
      );
    };

    /** Whether `fn` is a named, reusable function rather than a callback written inline. */
    const isReusable = (fn: FunctionNode) => {
      if (fn.type === "FunctionDeclaration") return true;

      const { parent } = fn;

      if (parent.type === "MethodDefinition") return parent.kind === "method";

      if (parent.type === "Property") {
        return parent.kind === "init" && !isInlineCallbacks(parent.parent, propertyKey(parent));
      }

      return parent.type === "VariableDeclarator" || parent.type === "PropertyDefinition";
    };

    const check = (fn: FunctionNode) => {
      if (fn.async || fn.generator || fn.body === null || !isReusable(fn)) return;

      const { body } = fn;

      if (body.type !== "BlockStatement") {
        if (isGeneratorCall(body)) context.report({ node: fn, messageId: "effectFn" });

        return;
      }

      const [statement] = body.body;

      if (
        body.body.length === 1 &&
        statement?.type === "ReturnStatement" &&
        statement.argument !== null &&
        isGeneratorCall(statement.argument)
      ) {
        context.report({ node: fn, messageId: "effectFn" });
      }
    };

    return {
      ArrowFunctionExpression: check,
      FunctionExpression: check,
      FunctionDeclaration: check,
    };
  },
});
