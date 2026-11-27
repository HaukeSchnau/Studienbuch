import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { defineRule } from "@oxlint/plugins";

import { clientCode, type Scope } from "../scope.ts";
import { fileStart } from "../syntax.ts";

export const scope: Scope = { files: clientCode };

const PLATFORM_FILE =
  /^(?<stem>.+)\.(?<platform>web|native|ios|android)\.(?<extension>tsx?|jsx?)$/u;

// The order in which Metro tries extensions (`resolver.sourceExts`), for the ones our code uses.
const EXTENSIONS = ["ts", "tsx", "js", "jsx"];

/**
 * A platform file such as `useConfirm.web.tsx` has no twin with an extension Metro tries first.
 * Metro tries every platform for one extension before the next, so `useConfirm.ts` wins on the
 * web over `useConfirm.web.tsx`, and on iOS `sheet.native.ts` wins over `sheet.ios.tsx`.
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow a twin that Metro resolves before a platform file.",
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

    const phone = platform === "ios" || platform === "android";

    const twin = EXTENSIONS.slice(0, EXTENSIONS.indexOf(extension))
      .flatMap((each) =>
        phone ? [`${stem}.native.${each}`, `${stem}.${each}`] : [`${stem}.${each}`],
      )
      .find(exists);

    if (twin === undefined) return {};

    return {
      Program(node) {
        context.report({
          node: fileStart(node),
          messageId: "extension",
          data: { twin, file, platform },
        });
      },
    };
  },
});
