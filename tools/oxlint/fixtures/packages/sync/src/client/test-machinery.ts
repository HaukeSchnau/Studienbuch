// Code that ships takes neither the test machinery nor the dependencies only tests install.

// oxlint-disable-next-line studienbuch/test-only-imports -- fixture: the client reaches into sync's testing/
export { engines } from "../testing/engines.ts";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: drizzle-kit is a development dependency
export { generateMigration } from "drizzle-kit/api-postgres";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: PGlite is a development dependency
export { PgliteClient } from "@effect/sql-pglite";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Vitest loads only in tests
export { inject } from "vitest";

// oxlint-disable-next-line studienbuch/test-only-imports -- fixture: a template literal names the test entry
export const postgres = () => import(`@stu/sync/testing`);
