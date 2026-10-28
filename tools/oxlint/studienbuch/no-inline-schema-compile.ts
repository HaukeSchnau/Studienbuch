import { defineRule, type ESTree } from "@oxlint/plugins";

import { resolve } from "./bindings.ts";
import { enclosingFunction, memberKey, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.). T3 counts any member expression as a schema declared elsewhere. Here `table.codec` on a
// parameter doesn't count, because it can't be hoisted either.

const COMPILERS = new Set([
  "is",
  "asserts",
  "decodeEffect",
  "decodeExit",
  "decodeOption",
  "decodePromise",
  "decodeResult",
  "decodeSync",
  "decodeUnknownExit",
  "decodeUnknownEffect",
  "decodeUnknownOption",
  "decodeUnknownPromise",
  "decodeUnknownResult",
  "decodeUnknownSync",
  "encodeExit",
  "encodeEffect",
  "encodeOption",
  "encodePromise",
  "encodeResult",
  "encodeSync",
  "encodeUnknownExit",
  "encodeUnknownEffect",
  "encodeUnknownOption",
  "encodeUnknownPromise",
  "encodeUnknownResult",
  "encodeUnknownSync",
]);

/** `decodeSync` for `Schema.decodeSync`, null for any other callee. */
function schemaMember(callee: ESTree.Node): string | null {
  const expression = unwrap(callee);

  if (expression.type !== "MemberExpression") return null;

  const object = unwrap(expression.object);

  return object.type === "Identifier" && object.name === "Schema" ? memberKey(expression) : null;
}

/** A decoder or encoder compiled and run inside a function is compiled again on every call. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Schema decoder and encoder compiler calls inside function bodies; hoist them to module scope.",
    },
    messages: {
      inlineSchema:
        "Hoist Schema.{{method}}(...) to module scope. Both the inline schema and the compiled function are rebuilt on every call, so move the compiled function to a module-level const.",
      inlineCompile:
        "Hoist Schema.{{method}}(...) to module scope. The compiled function is rebuilt on every call, so move it to a module-level const.",
    },
  },
  create(context) {
    /** Whether `node` is a member of a function parameter, such as `table.codec`. */
    const isParameterMember = (node: ESTree.MemberExpression) => {
      let root = unwrap(node.object);

      while (root.type === "MemberExpression") root = unwrap(root.object);

      return (
        root.type === "Identifier" &&
        resolve(context, root, root.name)?.defs[0]?.type === "Parameter"
      );
    };

    /** `Homework` or `Sync.Row`: a schema declared once, somewhere else. */
    const isStaticSchemaReference = (node: ESTree.Node) => {
      const expression = unwrap(node);

      if (expression.type === "Identifier") return /^[A-Z]/u.test(expression.name);

      return expression.type === "MemberExpression" && !isParameterMember(expression);
    };

    /** `Schema.Struct({ … })`: a schema built right here, on every call. */
    const isInlineSchema = (node: ESTree.Node): boolean => {
      const expression = unwrap(node);

      if (expression.type !== "CallExpression") return false;

      const member = schemaMember(expression.callee);

      if (member !== "fromJsonString") return member !== null;

      const [inner] = expression.arguments;

      return inner !== undefined && (isStaticSchemaReference(inner) || isInlineSchema(inner));
    };

    return {
      CallExpression(node) {
        const method = schemaMember(node.callee);

        if (method === null || !COMPILERS.has(method) || enclosingFunction(node) === null) return;

        const call = node.parent;

        if (call.type !== "CallExpression" || unwrap(call.callee) !== node) return;

        const [schema] = node.arguments;

        if (schema === undefined) return;

        if (isInlineSchema(schema)) {
          context.report({ node: node.callee, messageId: "inlineSchema", data: { method } });
        } else if (isStaticSchemaReference(schema)) {
          context.report({ node: node.callee, messageId: "inlineCompile", data: { method } });
        }
      },
    };
  },
});
