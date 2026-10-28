import { definePlugin } from "@oxlint/plugins";

import effectFnName from "./effect-fn-name.ts";
import importBoundaries from "./import-boundaries.ts";
import selfExportingModules from "./module-shape.ts";
import noAdHocStateOrEffects from "./no-ad-hoc-state-or-effects.ts";
import noBakedOrigin from "./no-baked-origin.ts";
import noFileKindDirectories from "./no-file-kind-directories.ts";
import noHermesUnsupportedApis from "./no-hermes-unsupported-apis.ts";
import noHooklessUseFunction from "./no-hookless-use-function.ts";
import noPollingLoopInTests from "./no-polling-loop-in-tests.ts";
import noRealTimeWaitInTests from "./no-real-time-wait-in-tests.ts";
import noTestTimeoutOrUnreasonedSkip from "./no-test-timeout-or-unreasoned-skip.ts";
import noThrowingErrors from "./no-throwing-errors.ts";
import noWallClockInTests from "./no-wall-clock-in-tests.ts";
import requireSuppressionReason from "./require-suppression-reason.ts";
import taggedErrorName from "./tagged-error-name.ts";

/** Studienbuch's own rules: the conventions in AGENTS.md that a linter can check. */
export default definePlugin({
  meta: { name: "studienbuch" },
  rules: {
    "effect-fn-name": effectFnName,
    "import-boundaries": importBoundaries,
    "module-shape": selfExportingModules,
    "no-ad-hoc-state-or-effects": noAdHocStateOrEffects,
    "no-baked-origin": noBakedOrigin,
    "no-file-kind-directories": noFileKindDirectories,
    "no-hermes-unsupported-apis": noHermesUnsupportedApis,
    "no-hookless-use-function": noHooklessUseFunction,
    "no-polling-loop-in-tests": noPollingLoopInTests,
    "no-real-time-wait-in-tests": noRealTimeWaitInTests,
    "no-test-timeout-or-unreasoned-skip": noTestTimeoutOrUnreasonedSkip,
    "no-throwing-errors": noThrowingErrors,
    "no-wall-clock-in-tests": noWallClockInTests,
    "require-suppression-reason": requireSuppressionReason,
    "tagged-error-name": taggedErrorName,
  },
});
