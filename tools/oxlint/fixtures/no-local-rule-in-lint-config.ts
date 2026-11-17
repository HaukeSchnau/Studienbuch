export const lint = {
  rules: {
    // oxlint-disable-next-line studienbuch/no-local-rule-in-lint-config -- fixture: a local rule turned on in the config
    "studienbuch/no-throwing-errors": "error",
    "eslint/eqeqeq": "error",
  },
  // The plugin's own name and path pass.
  jsPlugins: [{ name: "studienbuch", specifier: "./tools/oxlint/studienbuch/index.ts" }],
};
