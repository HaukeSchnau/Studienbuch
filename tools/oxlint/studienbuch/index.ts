import { definePlugin } from "@oxlint/plugins";

import demoAccountBoundaries from "./demo-account-boundaries.ts";
import effectFnName from "./effect-fn-name.ts";
import importBoundaries from "./import-boundaries.ts";
import selfExportingModules from "./module-shape.ts";
import namespaceNodeImports from "./namespace-node-imports.ts";
import noAdHocStateOrEffects from "./no-ad-hoc-state-or-effects.ts";
import noBakedOrigin from "./no-baked-origin.ts";
import noDomTestEnvironment from "./no-dom-test-environment.ts";
import noEmDashCopy from "./no-em-dash-copy.ts";
import noFileKindDirectories from "./no-file-kind-directories.ts";
import noFrameWaitsInBrowserTests from "./no-frame-waits-in-browser-tests.ts";
import noGlobalProcessRuntime from "./no-global-process-runtime.ts";
import noHermesUnsupportedApis from "./no-hermes-unsupported-apis.ts";
import noHooklessUseFunction from "./no-hookless-use-function.ts";
import noInlineSchemaCompile from "./no-inline-schema-compile.ts";
import noLowValueComments from "./no-low-value-comments.ts";
import noManualEffectRuntimeInTests from "./no-manual-effect-runtime-in-tests.ts";
import noNativeTitleTooltip from "./no-native-title-tooltip.ts";
import noPollingLoopInTests from "./no-polling-loop-in-tests.ts";
import noRawResizeObserver from "./no-raw-resize-observer.ts";
import noRealTimeWaitInTests from "./no-real-time-wait-in-tests.ts";
import noTestInLoop from "./no-test-in-loop.ts";
import noTestTimeoutOrUnreasonedSkip from "./no-test-timeout-or-unreasoned-skip.ts";
import noThrowingErrors from "./no-throwing-errors.ts";
import noWallClockInTests from "./no-wall-clock-in-tests.ts";
import preferCatchTags from "./prefer-catch-tags.ts";
import preferEffectFn from "./prefer-effect-fn.ts";
import requireDisposableRender from "./require-disposable-render.ts";
import requireRegisteredListScroll from "./require-registered-list-scroll.ts";
import requireSuppressionReason from "./require-suppression-reason.ts";
import taggedErrorName from "./tagged-error-name.ts";
import testOnlyImports from "./test-only-imports.ts";

/** Studienbuch's own rules: the conventions in AGENTS.md that a linter can check. */
export default definePlugin({
  meta: { name: "studienbuch" },
  rules: {
    "demo-account-boundaries": demoAccountBoundaries,
    "effect-fn-name": effectFnName,
    "import-boundaries": importBoundaries,
    "module-shape": selfExportingModules,
    "namespace-node-imports": namespaceNodeImports,
    "no-ad-hoc-state-or-effects": noAdHocStateOrEffects,
    "no-baked-origin": noBakedOrigin,
    "no-dom-test-environment": noDomTestEnvironment,
    "no-em-dash-copy": noEmDashCopy,
    "no-file-kind-directories": noFileKindDirectories,
    "no-frame-waits-in-browser-tests": noFrameWaitsInBrowserTests,
    "no-global-process-runtime": noGlobalProcessRuntime,
    "no-hermes-unsupported-apis": noHermesUnsupportedApis,
    "no-hookless-use-function": noHooklessUseFunction,
    "no-inline-schema-compile": noInlineSchemaCompile,
    "no-low-value-comments": noLowValueComments,
    "no-manual-effect-runtime-in-tests": noManualEffectRuntimeInTests,
    "no-native-title-tooltip": noNativeTitleTooltip,
    "no-polling-loop-in-tests": noPollingLoopInTests,
    "no-raw-resize-observer": noRawResizeObserver,
    "no-real-time-wait-in-tests": noRealTimeWaitInTests,
    "no-test-in-loop": noTestInLoop,
    "no-test-timeout-or-unreasoned-skip": noTestTimeoutOrUnreasonedSkip,
    "no-throwing-errors": noThrowingErrors,
    "no-wall-clock-in-tests": noWallClockInTests,
    "prefer-catch-tags": preferCatchTags,
    "prefer-effect-fn": preferEffectFn,
    "require-disposable-render": requireDisposableRender,
    "require-registered-list-scroll": requireRegisteredListScroll,
    "require-suppression-reason": requireSuppressionReason,
    "tagged-error-name": taggedErrorName,
    "test-only-imports": testOnlyImports,
  },
});
