import { defineRule, type ESTree } from "@oxlint/plugins";

import { layoutPath } from "./repository-path.ts";
import { isStringLiteral } from "./syntax.ts";

// Demo accounts are the only accounts the server signs in without a password and derives a root
// key for (invariant 14, ADR 0027). What makes or reaches one has a single home each, so a route
// can't grow a way in. Names count as identifiers and as strings, which bracket access uses.
// Tests are exempt in vite.config.ts.

interface Capability {
  readonly what: string;
  readonly home: string;
  readonly files: ReadonlyArray<string>;
}

const signInDemo: Capability = {
  what: "A session without a password",
  home: "`Demo.signIn` in demo/PersonaSignIn.ts",
  files: ["apps/server/src/auth/Auth.ts", "apps/server/src/demo/PersonaSignIn.ts"],
};

const seeding: Capability = {
  what: "The permission to create demo accounts",
  home: "`prepare` and the console in main.ts",
  files: ["apps/server/src/demo/DemoAccounts.ts", "apps/server/src/main.ts"],
};

const demoTable: Capability = {
  what: "The `demo_account` table",
  home: "`DemoAccounts`, and its Drizzle declaration in demo/DemoTables.ts",
  files: ["apps/server/src/demo/DemoAccounts.ts", "apps/server/src/demo/DemoTables.ts"],
};

const NAMES: ReadonlyMap<string, Capability> = new Map([
  ["signInDemo", signInDemo],
  ["Seeding", seeding],
  ["seeding", seeding],
  ["demoAccount", demoTable],
]);

/** Only their own modules mint demo sessions, grant `Seeding` or touch `demo_account`. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep demo sessions, the seed's permission and the demo_account table in their own modules.",
    },
    messages: {
      outOfPlace: "{{what}} stays in {{home}} (invariant 14).",
    },
  },
  create(context) {
    const file = layoutPath(context);

    const check = (capability: Capability | undefined, node: ESTree.Node) => {
      if (capability === undefined || capability.files.includes(file)) return;

      context.report({
        node,
        messageId: "outOfPlace",
        data: { what: capability.what, home: capability.home },
      });
    };

    const text = (value: string, node: ESTree.Node) => {
      check(value.includes("demo_account") ? demoTable : NAMES.get(value), node);
    };

    return {
      Identifier(node) {
        check(NAMES.get(node.name), node);
      },
      Literal(node) {
        if (isStringLiteral(node)) text(node.value, node);
      },
      TemplateElement(node) {
        text(node.value.cooked ?? node.value.raw, node);
      },
    };
  },
});
