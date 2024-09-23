import baseConfig, { restrictEnvAccess } from "@stu/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ["src/holidays/generated/**", "dist/**"],
  },
  ...baseConfig,
  ...restrictEnvAccess,
];
