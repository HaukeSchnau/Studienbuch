import { defineRule, type ESTree } from "@oxlint/plugins";

import { importOf, isGlobalRead } from "./bindings.ts";
import { memberKey, moduleExportName, unwrap } from "./syntax.ts";

// Members of Effect modules that read or wait on the clock. Whole modules (`Clock`, `Random`,
// `Crypto`, Temporal's `Now`) are import-boundaries' to bar, and effect-native's `global-date`,
// `global-random` and `crypto-random-uuid` already report `Date`, `Math.random` and
// `crypto.randomUUID`.
const CLOCK_MEMBERS = new Map<string, ReadonlySet<string>>([
  ["DateTime", new Set(["now", "nowAsDate", "nowInCurrentZone", "nowUnsafe"])],
  [
    "Effect",
    new Set(["clockWith", "delay", "sleep", "timed", "timeout", "timeoutOption", "timeoutOrElse"]),
  ],
]);

// Host globals that hand out randomness or time.
const AMBIENT_GLOBALS = new Set(["crypto", "performance"]);

const GLOBAL_THIS = new Set(["globalThis"]);

const EFFECT_MODULE = /^effect\/(?<name>[A-Za-z]+)$/u;

/** `DateTime` for `* as DateTime from "effect/DateTime"` or `{ DateTime } from "effect"`. */
function effectModule(module: string, name: string): string | null {
  if (module === "effect") return name;

  return name === "*" ? (EFFECT_MODULE.exec(module)?.groups?.name ?? null) : null;
}

/** Mutators give the same result on every device and on the server, so core reads no clock. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading the clock or randomness in packages/core: `DateTime.now`, `Effect.sleep` and its kin, `crypto` and `performance`.",
    },
    messages: {
      ambient:
        "`{{read}}` reads the clock or randomness. Mutators read neither, so a replay gives the same result everywhere: ids and timestamps arrive as arguments.",
    },
  },
  create(context) {
    const report = (node: ESTree.Node, read: string) =>
      context.report({ node, messageId: "ambient", data: { read } });

    /** `{ now } from "effect/DateTime"` is `DateTime.now` under another name. */
    const checkImport = (node: ESTree.ImportDeclaration) => {
      const module = EFFECT_MODULE.exec(node.source.value)?.groups?.name;
      const members = module === undefined ? undefined : CLOCK_MEMBERS.get(module);

      if (members === undefined) return;

      for (const specifier of node.specifiers) {
        if (specifier.type !== "ImportSpecifier") continue;

        const name = moduleExportName(specifier.imported);

        if (members.has(name)) report(specifier, `${module}.${name}`);
      }
    };

    const isGlobal = (node: ESTree.Node, names: ReadonlySet<string>) =>
      node.type === "Identifier" && names.has(node.name) && isGlobalRead(context, node);

    return {
      ImportDeclaration: checkImport,
      MemberExpression(node) {
        const object = unwrap(node.object);
        const key = memberKey(node);

        if (key === null || object.type !== "Identifier") return;

        const binding = importOf(context, object);
        const module = binding === null ? null : effectModule(binding.module, binding.name);

        if (module !== null && CLOCK_MEMBERS.get(module)?.has(key) === true) {
          report(node, `${module}.${key}`);
        } else if (AMBIENT_GLOBALS.has(key) && isGlobal(object, GLOBAL_THIS)) {
          report(node, `globalThis.${key}`);
        }
      },
      Identifier(node) {
        if (!isGlobal(node, AMBIENT_GLOBALS)) return;

        const parent = node.parent;

        const member =
          parent.type === "MemberExpression" && parent.object === node ? memberKey(parent) : null;

        // effect-native's crypto-random-uuid reports this one.
        if (node.name === "crypto" && member === "randomUUID") return;

        report(node, member === null ? node.name : `${node.name}.${member}`);
      },
    };
  },
});
