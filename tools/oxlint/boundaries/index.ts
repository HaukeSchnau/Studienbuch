import { definePlugin } from "@oxlint/plugins";

import { noProjectNameRule } from "./rules/no-project-name.ts";

/** Rules that keep reusable code free of this specific project's vocabulary. */
const boundariesPlugin = definePlugin({
  meta: { name: "boundaries" },
  rules: {
    "no-project-name": noProjectNameRule,
  },
});

export default boundariesPlugin;
