# Drizzle behind a seam

Status: accepted 2026-10-28 ([D17](https://files.schnau.dev/html/studienbuch-roadmap/#D17), [D53](https://files.schnau.dev/html/studienbuch-roadmap/#D53)). The device half waits for the `Tx` conformance spike in M0.

On the server, Drizzle declares every Postgres table we own, Better Auth's included, and drizzle-kit generates the migrations as SQL. Our hash-checked runner applies them in `prepare` under an advisory lock. Queries use Drizzle's `effect-postgres` driver, which runs on Effect's `PgClient`, so there is one pool and Effect owns transactions. The engine's few Postgres-specific statements use Effect's `sql` on the same connection. If the driver lags an Effect release, Drizzle builds the query with `toSQL()` and Effect runs it.

On the device, `Sync.table` produces the Drizzle `sqliteTable`, typed reads run through Drizzle's `sqlite-proxy` driver on our Effect `SqlClient` on iOS, Android and the web, and drizzle-kit generates the device migrations. That gives one schema source and one query builder on both sides. Reactivity comes from Effect atoms, not Drizzle's live queries.

The seam exists because the old repository pinned Drizzle preview builds whose Effect integration held Effect back at a release candidate. Drizzle 1.0 is still a release candidate, so its pin moves together with Effect's.

Reasoning: [stack.md, Drizzle](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/stack.md#drizzle-kept-on-the-server-behind-a-seam-d17), [D53](https://files.schnau.dev/html/studienbuch-roadmap/#D53).
