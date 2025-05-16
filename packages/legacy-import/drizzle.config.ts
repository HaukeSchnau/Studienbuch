import type { Config } from "drizzle-kit";

import { env } from "./env";

export default {
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.LEGACY_DATABASE_URL,
  },
  verbose: true,
} satisfies Config;
