/**
 * Everything in this package that is specific to Studienbuch.
 *
 * The rest of `@stu/server` is a project-free PostgreSQL seam: a pooled Effect + Drizzle client,
 * a migration runner, and a scoped lifecycle. Copying it into another project means rewriting this
 * one file, which is why `boundaries/no-project-name` refuses the literal "studienbuch" elsewhere.
 */

/** Reported to PostgreSQL as `application_name`, so connections are attributable in `pg_stat`. */
export const applicationName = "studienbuch-server" as const;

/**
 * Where applied migrations are recorded.
 *
 * Two code paths write this bookkeeping: `drizzle-kit migrate` during development, and the server's
 * own `migrateToLatest` at startup. They must agree, or each would see the other's migrations as
 * pending and try to re-apply them. Both import these constants; neither restates them.
 *
 * Drizzle's runtime migrator defaults `migrationsSchema` to `"drizzle"`, so the schema must be
 * passed explicitly wherever it is used.
 */
export const migrationsTable = "studienbuch_migrations" as const;
export const migrationsSchema = "public" as const;

/** Environment variables this package reads. */
export const environmentVariables = {
  databaseUrl: "DATABASE_URL",
  migrationsDirectory: "STUDIENBUCH_MIGRATIONS_DIR",
} as const;
