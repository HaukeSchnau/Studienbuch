import { defineRule, type ESTree } from "@oxlint/plugins";

import { layoutPath } from "./repository-path.ts";
import { isStringLiteral } from "./syntax.ts";

// Demo accounts are the only accounts the server signs in without a password and derives a root
// key for (invariant 14, ADR 0027). What makes or reaches one has a single home each, so a route
// can't grow a way in. Tests are exempt in vite.config.ts.

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
  files: ["apps/server/src/main.ts"],
};

const demoTable: Capability = {
  what: "The Drizzle table of `demo_account`",
  home: "demo/DemoTables.ts, which drizzle-kit reads; write the table in `DemoAccounts.ensure`",
  files: ["apps/server/src/demo/DemoTables.ts"],
};

const demoWrite: Capability = {
  what: "Writing `demo_account`",
  home: "`DemoAccounts.ensure`",
  files: ["apps/server/src/demo/DemoAccounts.ts"],
};

const WRITE = /\b(?:insert\s+into|update|delete\s+from)\s+"?demo_account\b/iu;

/** Only their own modules mint demo sessions, grant `Seeding` or write `demo_account`. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep demo sessions, the seed's permission and writes to demo_account in their own modules.",
    },
    messages: {
      outOfPlace: "{{what}} stays in {{home}} (invariant 14).",
    },
  },
  create(context) {
    const file = layoutPath(context);

    const check = (capability: Capability, node: ESTree.Node) => {
      if (capability.files.includes(file)) return;

      context.report({
        node,
        messageId: "outOfPlace",
        data: { what: capability.what, home: capability.home },
      });
    };

    const text = (value: string, node: ESTree.Node) => {
      if (WRITE.test(value)) check(demoWrite, node);
    };

    return {
      Identifier(node) {
        if (node.name === "signInDemo") check(signInDemo, node);

        if (node.name === "demoAccount") check(demoTable, node);
      },
      MemberExpression(node) {
        if (
          !node.computed &&
          node.object.type === "Identifier" &&
          node.object.name === "DemoAccounts" &&
          node.property.type === "Identifier" &&
          node.property.name === "seeding"
        ) {
          check(seeding, node);
        }
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
