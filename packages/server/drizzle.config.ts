import { defineConfig } from "drizzle-kit";
import { migrationsSchema, migrationsTable } from "./src/database/migration-history.ts";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.trim() === "") {
  console.error("DATABASE_URL is required to run Drizzle Kit");
  process.exit(1);
}

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/access/schema.ts",
    "./src/auth/schema.ts",
    "./src/enquiry/schema.ts",
    "./src/importing/schema.ts",
    "./src/organization/course-schema.ts",
    "./src/organization/schema.ts",
    "./src/schedule/schema.ts",
  ],
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
