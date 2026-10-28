import { defineRule, type ESTree } from "@oxlint/plugins";

import { importOf } from "./bindings.ts";
import { isInDocumentedHook } from "./custom-hooks.ts";
import { memberKey, pathOf, propertyKey, unwrap } from "./syntax.ts";

// Ported from T3 Code's rule of the same name (github.com/pingdotgg/t3code, MIT, copyright T3 Tools
// Inc.), and extended to React Native's `Platform` and Expo's `EXPO_OS`, the same host read on a
// device.

const HOST_PROPERTIES = new Set(["platform", "arch"]);
const NODE_OS = new Set(["node:os", "os"]);

/** `process` or `globalThis.process`. */
function isProcess(node: ESTree.Node): boolean {
  const expression = unwrap(node);

  if (expression.type === "Identifier") return expression.name === "process";

  if (expression.type !== "MemberExpression") return false;

  const object = unwrap(expression.object);

  return (
    object.type === "Identifier" &&
    object.name === "globalThis" &&
    memberKey(expression) === "process"
  );
}

/** Feature code receives the host it runs on instead of reading it, so tests can choose it. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading the host's platform or architecture in feature code: `process.platform`, `os.arch()`, React Native's `Platform` and `process.env.EXPO_OS`.",
    },
    messages: {
      hostProcess:
        "Inject the host's {{property}} as a service instead of reading it here, so a test can provide it explicitly.",
      nativePlatform:
        "Feature code gets the platform through an injected service or a documented `use…` hook, not `{{read}}`. Platform differences live in infra/ adapters, ui/ components, app/ routes and `.web.tsx` or `.native.tsx` files.",
    },
  },
  create(context) {
    /** `platform` for `os.platform` or a `platform` imported from node:os. */
    const nodeOsCall = (callee: ESTree.Node): string | null => {
      const expression = unwrap(callee);

      if (expression.type === "Identifier") {
        const binding = importOf(context, expression);

        return binding !== null && NODE_OS.has(binding.module) && HOST_PROPERTIES.has(binding.name)
          ? binding.name
          : null;
      }

      if (expression.type !== "MemberExpression") return null;

      const object = unwrap(expression.object);
      const key = memberKey(expression);
      const binding = object.type === "Identifier" ? importOf(context, object) : null;

      return binding !== null &&
        NODE_OS.has(binding.module) &&
        binding.name === "*" &&
        key !== null &&
        HOST_PROPERTIES.has(key)
        ? key
        : null;
    };

    /** `Platform` imported from react-native, or `RN.Platform` through a namespace import. */
    const isNativePlatform = (node: ESTree.Node) => {
      const expression = unwrap(node);

      if (expression.type === "Identifier") {
        const binding = importOf(context, expression);

        return binding?.module === "react-native" && binding.name === "Platform";
      }

      if (expression.type !== "MemberExpression" || memberKey(expression) !== "Platform") {
        return false;
      }

      const object = unwrap(expression.object);
      const binding = object.type === "Identifier" ? importOf(context, object) : null;

      return binding?.module === "react-native" && binding.name === "*";
    };

    const reportRead = (node: ESTree.Node, read: string) => {
      if (!isInDocumentedHook(context, node)) {
        context.report({ node, messageId: "nativePlatform", data: { read } });
      }
    };

    return {
      MemberExpression(node) {
        const key = memberKey(node);

        if (key === null) return;

        if (HOST_PROPERTIES.has(key) && isProcess(node.object)) {
          context.report({ node, messageId: "hostProcess", data: { property: key } });
        } else if (isNativePlatform(node.object)) {
          reportRead(node, `Platform.${key}`);
        } else if (key === "EXPO_OS" && pathOf(node.object)?.endsWith("process.env") === true) {
          reportRead(node, "process.env.EXPO_OS");
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || node.init === null) return;

        if (!isNativePlatform(node.init)) return;

        // `const { OS } = Platform` reads `Platform.OS`.
        for (const property of node.id.properties) {
          if (property.type === "Property") {
            reportRead(property, `Platform.${propertyKey(property) ?? "…"}`);
          }
        }
      },
      CallExpression(node) {
        const property = nodeOsCall(node.callee);

        if (property !== null) {
          context.report({ node, messageId: "hostProcess", data: { property } });
        }
      },
    };
  },
});
