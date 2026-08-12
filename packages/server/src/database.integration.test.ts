import { expect, it } from "@effect/vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/effect-postgres/migrator";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { fileURLToPath } from "node:url";
import { Database } from "./database.ts";
import { users } from "./schema/auth.ts";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

it.live(
  "runs migrations and queries through the Effect Drizzle database",
  () =>
    Effect.acquireUseRelease(
      Effect.promise(() => new PostgreSqlContainer("postgres:17-alpine").start()),
      (container) =>
        Effect.gen(function* () {
          const database = yield* Database.Service;

          yield* migrate(database.drizzle, {
            migrationsFolder,
            migrationsTable: "studienbuch_migrations",
          });

          const inserted = yield* database.drizzle
            .insert(users)
            .values({ email: "ada@example.test", name: "Ada Lovelace" })
            .returning({ id: users.id });
          const created = inserted[0];
          if (created === undefined) {
            return yield* Effect.die("PostgreSQL did not return the inserted user");
          }
          const selected = yield* database.drizzle
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, created.id));

          expect(selected).toEqual([{ email: "ada@example.test", name: "Ada Lovelace" }]);
        }).pipe(
          Effect.provide(
            Database.layer({
              url: Redacted.make(container.getConnectionUri()),
              maxConnections: 2,
            }),
          ),
        ),
      (container) => Effect.promise(() => container.stop()),
    ),
  { timeout: 120_000 },
);
