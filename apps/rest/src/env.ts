import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_PORT: z.coerce.number(),
    AXIOM_DATASET: z.string().min(1),
    AXIOM_TOKEN: z.string().min(1),
  },
  experimental__runtimeEnv: {
    API_PORT: process.env.API_PORT,
    AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET,
    AXIOM_TOKEN: process.env.NEXT_PUBLIC_AXIOM_TOKEN,
  },
  skipValidation: !!process.env.CI || !!process.env.SKIP_ENV_VALIDATION,
});
