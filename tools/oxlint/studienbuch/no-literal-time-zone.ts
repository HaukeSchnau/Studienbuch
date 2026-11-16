import { defineRule } from "@oxlint/plugins";

import { pathOf, staticString } from "./syntax.ts";

const CONSTRUCTORS = ["make", "makeOption", "makeEffect"];

// `CivilTime.TimeZone.make`, or `TimeZone.make` on a destructured import.
const constructsTimeZone = (path: string) =>
  CONSTRUCTORS.some((name) => path === `TimeZone.${name}` || path.endsWith(`.TimeZone.${name}`));

/** A school's "today" is in the zone its row names, so only core names one, through School.today. */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow a time zone written as a literal outside packages/core and tests.",
    },
    messages: {
      literalTimeZone:
        "`{{zone}}` decides what today is without the school. Compute it with `School.today`, which reads the school's row and falls back to `School.defaultTimeZone` before the row arrived.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const [argument] = node.arguments;
        const zone = argument === undefined ? null : staticString(argument);

        if (zone !== null && constructsTimeZone(pathOf(node.callee) ?? "")) {
          context.report({ node, messageId: "literalTimeZone", data: { zone } });
        }
      },
    };
  },
});
