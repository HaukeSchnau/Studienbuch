import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { defineRule } from "@oxlint/plugins";

const PLATFORM_FILE =
  /^(?<stem>.+)\.(?<platform>web|native|ios|android)\.(?<extension>tsx?|jsx?)$/u;

const EXTENSIONS = ["ts", "tsx", "js", "jsx"] as const;

/**
 * A platform file such as `useConfirm.web.tsx` shares its twin's extension. Metro tries every
 * platform for one extension before the next, so `useConfirm.ts` would win on the web over
 * `useConfirm.web.tsx`, and the web would silently run the phones' code.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require a platform file to share its twin's extension.",
    },
    messages: {
      extension:
        "`{{twin}}` resolves before `{{file}}` on {{platform}}, because Metro tries every platform for one extension before the next. Give both files the same extension.",
    },
  },
  create(context) {
    const file = NodePath.basename(context.filename);
    const match = PLATFORM_FILE.exec(file)?.groups;

    if (match === undefined) return {};

    const { stem = "", platform = "", extension = "" } = match;
    const directory = NodePath.dirname(context.filename);
    const exists = (name: string) => NodeFS.existsSync(NodePath.join(directory, name));

    if (exists(`${stem}.${extension}`)) return {};

    const twin = EXTENSIONS.map((each) => `${stem}.${each}`).find(exists);

    if (twin === undefined) return {};

    return {
      Program(node) {
        context.report({ node, messageId: "extension", data: { twin, file, platform } });
      },
    };
  },
});
