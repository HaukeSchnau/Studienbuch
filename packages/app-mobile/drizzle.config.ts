import type { Config } from "drizzle-kit";

export default {
  schema: "../../packages/student/src/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo",
  verbose: true,
  casing: "snake_case",
} satisfies Config;
