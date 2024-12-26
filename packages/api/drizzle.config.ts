import type { Config } from "drizzle-kit";

import { env } from "./env";

export default {
  schema: "./src/postgres/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url: env.CORE_DATABASE_URL },
  verbose: true,
} satisfies Config;
