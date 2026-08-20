/**
 * Where applied migrations are recorded.
 *
 * Two code paths write this bookkeeping: `drizzle-kit migrate` during development, and the Release
 * migration task in production. They must agree, or each would see the other's migrations as
 * pending and try to re-apply them. Both import these constants; neither restates them.
 *
 * Drizzle's runtime migrator defaults `migrationsSchema` to `"drizzle"`, so the schema must be
 * passed explicitly wherever it is used.
 */
export const migrationsTable = "studienbuch_migrations";
export const migrationsSchema = "public";
