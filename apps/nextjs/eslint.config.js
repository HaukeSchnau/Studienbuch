import baseConfig, { restrictEnvAccess } from "@schnau/eslint-config/base";
import nextjsConfig from "@schnau/eslint-config/nextjs";
import reactConfig from "@schnau/eslint-config/react";

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
