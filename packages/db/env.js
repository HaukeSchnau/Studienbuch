/* eslint-disable no-restricted-properties */
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
export const env = createEnv({
    server: {
        DATABASE_PRISMA_URL: z.string().min(1),
        NODE_ENV: z.enum(["development", "production", "test"]),
    },
    client: {},
    experimental__runtimeEnv: {},
    skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
});
