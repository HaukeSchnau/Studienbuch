import { defineConfig } from "drizzle-kit";

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
    table: "studienbuch_migrations",
    schema: "public",
  },
  verbose: true,
});
