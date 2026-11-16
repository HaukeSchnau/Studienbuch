import { defineRule } from "@oxlint/plugins";

import { memberKey, staticString, unwrap } from "./syntax.ts";

const CONSTRUCTORS = new Set(["make", "makeOption", "makeEffect"]);

/**
 * "Today" comes from the school's row through core's `School.today`, so the device and the server
 * agree on it. Only core, the demo and dev schools, and tests write a time zone out.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `TimeZone.make` with a literal zone outside core, the demo and dev schools, and tests.",
    },
    messages: {
      literalTimeZone:
        "`{{zone}}` decides the date for every school. Read the school's row and call `School.today(school, now)` from @stu/core, which falls back to the default zone where no row arrived yet.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);

        if (callee.type !== "MemberExpression") return;

        if (!CONSTRUCTORS.has(memberKey(callee) ?? "")) return;

        const schema = unwrap(callee.object);

        const name =
          schema.type === "Identifier"
            ? schema.name
            : schema.type === "MemberExpression"
              ? memberKey(schema)
              : null;

        const [first] = node.arguments;
        const zone = first === undefined ? null : staticString(first);

        if (name === "TimeZone" && zone !== null) {
          context.report({ node, messageId: "literalTimeZone", data: { zone } });
        }
      },
    };
  },
});
