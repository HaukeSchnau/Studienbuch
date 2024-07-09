import type { Config } from "drizzle-kit";

import { env } from "./env";

export default {
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: env.POSTGRES_URL },
  verbose: true,
  strict: true,
} satisfies Config;
