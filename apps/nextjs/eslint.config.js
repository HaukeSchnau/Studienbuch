import baseConfig, { restrictEnvAccess } from "@stu/eslint-config/base";
import nextjsConfig from "@stu/eslint-config/nextjs";
import reactConfig from "@stu/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
];
