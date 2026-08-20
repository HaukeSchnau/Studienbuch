import { afterAll, beforeAll, expect, it } from "@effect/vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Auth } from "../auth/better-auth.ts";
import { Database } from "./client.ts";
import { migrateToLatest } from "./migrate.ts";
import { migrationsSchema, migrationsTable } from "./migration-history.ts";
import { users } from "../auth/schema.ts";

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
}, 120_000);

afterAll(async () => {
  await container.stop();
});

/** A migrated database on the shared container, rebuilt per test so pools never leak between them. */
const migrated = Layer.unwrap(
  Effect.sync(() =>
    Layer.effectDiscard(migrateToLatest).pipe(
      Layer.provideMerge(
        Database.layer({ url: Redacted.make(container.getConnectionUri()), maxConnections: 2 }),
      ),
    ),
  ),
);

it.live(
  "applies the migration history and round-trips rows through the Effect Drizzle database",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;

      const inserted = yield* database.drizzle
        .insert(users)
        .values({ email: "ada@example.test", name: "Ada Lovelace" })
        .returning({ id: users.id });
      const created = inserted[0];
      if (created === undefined) {
        return yield* Effect.die("PostgreSQL did not return the inserted user");
      }

      const selected = yield* database.drizzle
        .select({ email: users.email, name: users.name, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, created.id));

      expect(selected).toHaveLength(1);
      expect(selected[0]).toMatchObject({ email: "ada@example.test", name: "Ada Lovelace" });
      // Drizzle's `timestamp` column decodes to a Date; a raw string here means the pool's type
      // parsers were overridden and every consumer of this pool sees strings instead.
      expect(selected[0]?.createdAt).toBeInstanceOf(Date);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live(
  "hands native Date values to pool clients, as Better Auth's Kysely adapter requires",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      yield* Effect.promise(() =>
        database.pool.query(
          `insert into users (name, email) values ('Grace Hopper', 'grace@example.test')`,
        ),
      );

      // Better Auth reads sessions and users straight off this pool and configures its adapter with
      // `supportsDates: true`, so it never coerces strings back to Date. Session expiry and refresh
      // arithmetic break silently if PostgreSQL date types arrive unparsed.
      const result = yield* Effect.promise(() =>
        database.pool.query<{ createdAt: unknown; expiresAt: unknown }>(
          `select "createdAt", now() + interval '1 day' as "expiresAt"
           from users where email = 'grace@example.test'`,
        ),
      );

      expect(result.rows[0]?.createdAt).toBeInstanceOf(Date);
      expect(result.rows[0]?.expiresAt).toBeInstanceOf(Date);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live(
  "records migrations where Drizzle Kit expects them and stays idempotent on re-runs",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;

      // Development applies migrations with `drizzle-kit migrate`, production applies them in
      // process. Both must use the same bookkeeping table, or each would treat the other's work as
      // pending and try to replay it against tables that already exist.
      const bookkeeping = yield* Effect.promise(() =>
        database.pool.query<{ count: string }>(
          `select count(*)::text as count from ${migrationsSchema}.${migrationsTable}`,
        ),
      );
      expect(Number(bookkeeping.rows[0]?.count)).toBeGreaterThan(0);

      yield* migrateToLatest;

      const afterRerun = yield* Effect.promise(() =>
        database.pool.query<{ count: string }>(
          `select count(*)::text as count from ${migrationsSchema}.${migrationsTable}`,
        ),
      );
      expect(afterRerun.rows[0]?.count).toBe(bookkeeping.rows[0]?.count);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live(
  "signs a user up through the very schema Better Auth is mapped onto",
  () =>
    Effect.gen(function* () {
      const auth = yield* Auth.Service;
      const database = yield* Database.Service;

      const result = yield* Effect.promise(() =>
        auth.api.signUpEmail({
          body: { email: "ada-auth@example.test", password: "correct-horse-battery", name: "Ada" },
        }),
      );
      expect(result.user.email).toBe("ada-auth@example.test");

      // `db:generate` cannot see auth.ts, so nothing but agreement keeps the modelName mapping and
      // the migration history in step. Reading the rows back through our own tables is what makes
      // that agreement checkable: a renamed table or column fails here instead of at first login.
      const users = yield* Effect.promise(() =>
        database.pool.query<{ id: string; createdAt: unknown }>(
          `select id, "createdAt" from users where email = 'ada-auth@example.test'`,
        ),
      );
      expect(users.rowCount).toBe(1);
      // generateId: false means PostgreSQL's defaultRandom() owns identity.
      expect(users.rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(users.rows[0]?.createdAt).toBeInstanceOf(Date);

      const sessions = yield* Effect.promise(() =>
        database.pool.query(`select "expiresAt" from sessions`),
      );
      expect(sessions.rowCount).toBeGreaterThanOrEqual(0);
    }).pipe(Effect.provide(Layer.provideMerge(Auth.layer(), migrated))),
  { timeout: 60_000 },
);
