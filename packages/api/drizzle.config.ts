import type { Config } from "drizzle-kit";

import { env } from "./env";

export default {
  schema: "./src/postgres/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url: env.POSTGRES_URL },
  verbose: true,
} satisfies Config;
