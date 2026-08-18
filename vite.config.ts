import "vite-plus/test/config";
import { defineConfig } from "vite-plus";

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
    plugins: ["eslint", "oxc", "react", "unicorn", "typescript"],
    categories: {
      correctness: "error",
      perf: "error",
      suspicious: "error",
    },
    rules: {
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
      "react-in-jsx-scope": "off",
      "react/jsx-no-constructed-context-values": "off",
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
