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
      "result",
      "*.tsbuildinfo",
      "**/routeTree.gen.ts",
    ],
    plugins: ["effecttsgo", "eslint", "oxc", "react", "unicorn", "typescript"],
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
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "effecttsgo/abort-controller-in-effect": "error",
      "effecttsgo/crypto-random-uuid-in-effect": "error",
      "effecttsgo/global-console-in-effect": "error",
      "effecttsgo/global-date-in-effect": "error",
      "effecttsgo/global-fetch-in-effect": "error",
      "effecttsgo/global-random-in-effect": "error",
      "effecttsgo/global-timers-in-effect": "error",
      "effecttsgo/instance-of-schema": "error",
      "effecttsgo/process-env-in-effect": "error",
      "effecttsgo/unsafe-effect-type-assertion": "error",
      "effecttsgo/missed-pipeable-opportunity": "off",
      "effecttsgo/missing-pipeable-signature": "off",
      "effecttsgo/strict-boolean-expressions": "off",
      "effecttsgo/unnecessary-arrow-block": "off",
      "react-in-jsx-scope": "off",
      "react/jsx-no-constructed-context-values": "off",
      "react/no-object-type-as-default-prop": "off",
      "react/no-unstable-nested-components": "off",
      "react/style-prop-object": "off",
      "eslint/no-shadow": "off",
      "eslint/no-await-in-loop": "off",
      "eslint/no-underscore-dangle": "off",
      "typescript/consistent-return": "off",
      "typescript/no-unsafe-type-assertion": "off",
      "oxc/no-map-spread": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-array-reverse": "off",
      "unicorn/no-array-sort": "off",
    },
    overrides: [
      {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        rules: {
          "effecttsgo/strict-effect-provide": "off",
        },
      },
      {
        files: ["apps/console/src/runtime.ts", "scripts/lib/script.ts"],
        rules: {
          "effecttsgo/strict-effect-provide": "off",
        },
      },
    ],
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
