import type { Config } from "drizzle-kit";

import { env } from "./env";

export default {
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url: env.MANAGEMENT_DATABASE_URL },
  verbose: true,
  casing: "snake_case",
} satisfies Config;
