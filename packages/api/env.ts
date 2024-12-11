import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
    LIBSQL_URL: z.string(),
    LIBSQL_ADMIN_URL: z.string(),
    LIBSQL_ADMIN_AUTH_KEY: z.string(),
    POSTGRES_URL: z.string(),
    RABBITMQ_HOST: z.string(),
  },
  client: {},
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
});
