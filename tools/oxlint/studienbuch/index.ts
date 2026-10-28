import { definePlugin } from "@oxlint/plugins";

import effectFnName from "./effect-fn-name.ts";
import importBoundaries from "./import-boundaries.ts";
import selfExportingModules from "./module-shape.ts";
import noBakedOrigin from "./no-baked-origin.ts";
import noFileKindDirectories from "./no-file-kind-directories.ts";
import noHermesUnsupportedApis from "./no-hermes-unsupported-apis.ts";
import noThrowingErrors from "./no-throwing-errors.ts";
import requireSuppressionReason from "./require-suppression-reason.ts";
import taggedErrorName from "./tagged-error-name.ts";

/** Studienbuch's own rules: the conventions in AGENTS.md that a linter can check. */
export default definePlugin({
  meta: { name: "studienbuch" },
  rules: {
    "effect-fn-name": effectFnName,
    "import-boundaries": importBoundaries,
    "module-shape": selfExportingModules,
    "no-baked-origin": noBakedOrigin,
    "no-file-kind-directories": noFileKindDirectories,
    "no-hermes-unsupported-apis": noHermesUnsupportedApis,
    "no-throwing-errors": noThrowingErrors,
    "require-suppression-reason": requireSuppressionReason,
    "tagged-error-name": taggedErrorName,
  },
});
