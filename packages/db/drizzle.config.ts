import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.MANAGEMENT_DATABASE_URL },
  verbose: true,
  casing: "snake_case",
} satisfies Config;
