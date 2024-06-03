import type { Config } from "drizzle-kit";

import { env } from "./env";

export default {
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: env.DATABASE_PRISMA_URL },
  verbose: true,
  strict: true,
} satisfies Config;
