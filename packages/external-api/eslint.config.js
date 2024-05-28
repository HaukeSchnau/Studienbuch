import baseConfig, { restrictEnvAccess } from "@schnau/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["generated/**"],
  },
  ...baseConfig,
  ...restrictEnvAccess,
];
