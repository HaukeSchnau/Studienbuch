import { defineConfig } from "drizzle-kit";
import { migrationsSchema, migrationsTable } from "./src/project.ts";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.trim() === "") {
  console.error("DATABASE_URL is required to run Drizzle Kit");
  process.exit(1);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  migrations: {
    table: migrationsTable,
    schema: migrationsSchema,
  },
  verbose: true,
});
