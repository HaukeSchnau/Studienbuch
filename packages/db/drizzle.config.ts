import type { Config } from "drizzle-kit";

const url = process.env.MANAGEMENT_DATABASE_URL;
if (!url) {
  throw new Error("MANAGEMENT_DATABASE_URL is not set");
}

export default {
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  casing: "snake_case",
} satisfies Config;
