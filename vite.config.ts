import "vite-plus/test/config";
import { antipattern, correctness, style } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "vite-plus";

const effectRuleEntries: Array<[string, "error"]> = [];
for (const preset of [correctness, antipattern, style]) {
  for (const rule of Object.keys(preset.rules ?? {})) {
    effectRuleEntries.push([rule, "error"]);
  }
}
const effectRules = Object.fromEntries(effectRuleEntries);

export default defineConfig({
  fmt: {
    ignorePatterns: [
      "dist",
      "node_modules",
      "pnpm-lock.yaml",
      "pnpm-lock.web.yaml",
      "result",
      "*.tsbuildinfo",
      "**/routeTree.gen.ts",
    ],
    sortPackageJson: {},
  },
  lint: {
    jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
    ignorePatterns: [
      "dist",
      "node_modules",
      ".direnv",
      "pnpm-lock.yaml",
      "pnpm-lock.web.yaml",
      "result",
      "*.tsbuildinfo",
      "**/routeTree.gen.ts",
    ],
    plugins: ["effecttsgo", "eslint", "jsx-a11y", "oxc", "react", "unicorn", "typescript"],
    categories: {
      correctness: "error",
      perf: "error",
      suspicious: "error",
    },
    rules: {
      ...effectRules,
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-throwing-errors": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "effecttsgo/abort-controller-in-effect": "error",
      "effecttsgo/crypto-random-uuid-in-effect": "error",
      "effecttsgo/extends-native-error": "error",
      "effecttsgo/global-console-in-effect": "error",
      "effecttsgo/global-date-in-effect": "error",
      "effecttsgo/global-fetch-in-effect": "error",
      "effecttsgo/global-random-in-effect": "error",
      "effecttsgo/global-timers-in-effect": "error",
      "effecttsgo/instance-of-schema": "error",
      "effecttsgo/process-env-in-effect": "error",
      "effecttsgo/unsafe-effect-type-assertion": "error",
      "eslint/eqeqeq": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "unicorn/error-message": "error",
      "unicorn/prefer-node-protocol": "error",

      // This treats every exported fixed-arity function as an Effect-style `self` API; enabling it
      // would require dual overloads for ordinary route, React, CLI, and tooling helpers.
      "effecttsgo/missing-pipeable-signature": "off",

      // Final dependency provision belongs in tests and executable entry points, which this rule
      // cannot identify without maintaining a growing file allowlist.
      "effecttsgo/strict-effect-provide": "off",

      // JavaScript truthiness is readable in guards, while this rule emits especially noisy
      // diagnostics for framework-generated unions such as Expo's typed routes.
      "effecttsgo/strict-boolean-expressions": "off",

      // Mobile form flows intentionally focus their primary field when a screen opens; applying
      // the DOM-focused rule to React Native would reject that deliberate keyboard behavior.
      "jsx-a11y/no-autofocus": "off",

      // The automatic JSX runtime does not require React to be imported for JSX.
      "react-in-jsx-scope": "off",

      // React Compiler stabilizes constructed values, so manual memoization would duplicate it.
      "react/jsx-no-constructed-context-values": "off",

      // Object defaults can initialize state exactly once; forcing indirection at those call sites
      // makes the initialization harder to read without improving runtime behavior.
      "react/no-object-type-as-default-prop": "off",

      // Framework APIs such as navigation headers intentionally accept inline render callbacks,
      // which this rule mistakes for stateful nested component declarations.
      "react/no-unstable-nested-components": "off",

      // React Native has semantic `style` props and supports style arrays, not only object literals.
      "react/style-prop-object": "off",

      // Reusing a precise local name in a nested callback is clearer and TypeScript resolves the
      // scopes unambiguously.
      "eslint/no-shadow": "off",

      // Some loops must await sequentially to preserve ordering or apply backpressure.
      "eslint/no-await-in-loop": "off",

      // Effect's standard discriminated unions intentionally expose the `_tag` field.
      "eslint/no-underscore-dangle": "off",

      // TypeScript's noImplicitReturns catches missing paths; this rule misreads exhaustive
      // branches and Effect generators whose terminal branches yield errors.
      "typescript/consistent-return": "off",

      // Immutable map updates intentionally allocate; object spread is clearer than mutation for
      // the small collections where we use it.
      "oxc/no-map-spread": "off",

      // Keeping small helpers beside their only caller is more readable than hoisting them for a
      // negligible allocation optimization.
      "unicorn/consistent-function-scoping": "off",

      // In-place ordering is sometimes intentional; requiring copying variants changes allocation
      // and identity semantics rather than providing a universal improvement.
      "unicorn/no-array-reverse": "off",
      "unicorn/no-array-sort": "off",
    },
    env: {
      builtin: true,
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    passWithNoTests: true,
  },
});
