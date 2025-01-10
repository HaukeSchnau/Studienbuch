import type { Config } from "drizzle-kit";

export default {
  schema: "../../packages/student/src/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo",
  verbose: true,
} satisfies Config;
