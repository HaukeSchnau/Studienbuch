import { afterAll, beforeAll, expect, it } from "@effect/vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { and, count, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Auth } from "../auth/better-auth.ts";
import { Database } from "./client.ts";
import { migrateToLatest } from "./migrate.ts";
import { migrationsSchema, migrationsTable } from "./migration-history.ts";
import { users } from "../auth/schema.ts";
import { sourceImportRuns, sourceObservations } from "../importing/schema.ts";
import { SourceObservationStore } from "../importing/source-observation-store.ts";
import { DirectoryPreview } from "../webuntis/directory-preview.ts";
import {
  DirectoryObservation,
  hashDirectoryObservations,
  type DirectorySnapshot,
} from "../webuntis/directory-snapshot.ts";

/**
 * Testcontainers needs a Docker-compatible socket, and `DOCKER_HOST` is the contract for naming it:
 * the flake development shell sets it when a usable rootless Podman socket exists, and CI must set
 * it to opt in. A bare socket file is not enough of a signal -- `/var/run/docker.sock` can exist
 * and still be unusable -- so this checks the variable and nothing else.
 *
 * Skipping is loud rather than silent: without this the suite failed with
 * `Cannot read properties of undefined (reading 'stop')` from `afterAll`, which hid the real cause.
 */
const hasContainerRuntime =
  process.env.DOCKER_HOST !== undefined && process.env.DOCKER_HOST.trim() !== "";

if (!hasContainerRuntime) {
  console.warn(
    "[@stu/server] Skipping the database integration test: DOCKER_HOST is not set. " +
      "Run inside `nix develop` on a host with a Podman or Docker socket to exercise it.",
  );
}

let container: StartedPostgreSqlContainer | undefined;
let connectionUri = "";

beforeAll(async () => {
  if (!hasContainerRuntime) return;
  container = await new PostgreSqlContainer("postgres:17-alpine").start();
  connectionUri = container.getConnectionUri();
}, 120_000);

// Optional chaining, so a container that never started reports why `beforeAll` failed instead of
// replacing it with `Cannot read properties of undefined (reading 'stop')`.
afterAll(async () => {
  await container?.stop();
});

/** A migrated database on the shared container, rebuilt per test so pools never leak between them. */
const migrated = Layer.unwrap(
  Effect.sync(() =>
    Layer.effectDiscard(migrateToLatest).pipe(
      Layer.provideMerge(Database.layer({ url: Redacted.make(connectionUri), maxConnections: 2 })),
    ),
  ),
);

const directorySnapshot = (
  dataSourceId: string,
  schoolExternalId: string,
  schoolName: string,
): DirectorySnapshot => {
  const observation = DirectoryObservation.make({
    _tag: "School",
    externalId: schoolExternalId,
    payload: { name: schoolName, loginName: "school", hostName: null },
  });
  const observations = [observation];
  return {
    preview: DirectoryPreview.make({
      dataSourceId,
      provider: "WebUntis",
      school: { externalId: schoolExternalId, name: schoolName, loginName: "school" },
      academicYear: {
        externalId: "10",
        name: "2026/2027",
        start: "2026-08-13",
        end: "2027-07-07",
      },
      complete: true,
      ready: true,
      wouldImport: {
        schools: 1,
        academicYears: 0,
        departments: 0,
        buildings: 0,
        rooms: 0,
        classes: 0,
        teachers: 0,
        students: 0,
        activities: 0,
        holidays: 0,
        bellPeriods: 0,
      },
      ignored: { studentImages: 0, teacherImages: 0, assignmentGroups: 0 },
      diagnostics: [],
    }),
    contentHash: hashDirectoryObservations(observations),
    observations,
  };
};

it.live.runIf(hasContainerRuntime)(
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

it.live.runIf(hasContainerRuntime)(
  "stores immutable import generations and reuses an unchanged current snapshot",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const firstSnapshot = directorySnapshot("webuntis:store-test", "school-1", "First name");

      const concurrent = yield* Effect.all(
        [
          SourceObservationStore.persistDirectorySnapshot(firstSnapshot),
          SourceObservationStore.persistDirectorySnapshot(firstSnapshot),
        ],
        { concurrency: 2 },
      );
      const first = concurrent.find((result) => result._tag === "Imported");
      const repeated = concurrent.find((result) => result._tag === "Unchanged");
      expect(first).toBeDefined();
      expect(repeated).toBeDefined();
      if (first === undefined || repeated === undefined) return;
      const changed = yield* SourceObservationStore.persistDirectorySnapshot(
        directorySnapshot("webuntis:store-test", "school-1", "Changed name"),
      );

      expect(first._tag).toBe("Imported");
      expect(repeated).toMatchObject({ _tag: "Unchanged", runId: first.runId });
      expect(changed).toMatchObject({ _tag: "Imported" });
      expect(changed.runId).not.toBe(first.runId);

      const runs = yield* database.drizzle
        .select({ id: sourceImportRuns.id, isCurrent: sourceImportRuns.isCurrent })
        .from(sourceImportRuns)
        .where(eq(sourceImportRuns.dataSourceId, "webuntis:store-test"));
      const observations = yield* database.drizzle
        .select({ count: count() })
        .from(sourceObservations)
        .innerJoin(sourceImportRuns, eq(sourceImportRuns.id, sourceObservations.runId))
        .where(eq(sourceImportRuns.dataSourceId, "webuntis:store-test"));

      expect(runs).toHaveLength(2);
      expect(runs.filter((run) => run.isCurrent)).toEqual([{ id: changed.runId, isCurrent: true }]);
      expect(observations[0]?.count).toBe(2);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
  "rolls the whole generation back when an observation insert fails",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const valid = directorySnapshot("webuntis:rollback-test", "school-1", "Valid");
      const imported = yield* SourceObservationStore.persistDirectorySnapshot(valid);
      const duplicate = valid.observations[0];
      expect(duplicate).toBeDefined();
      if (duplicate === undefined) return;
      const observations = [duplicate, duplicate];
      const invalid: DirectorySnapshot = {
        ...valid,
        observations,
        contentHash: hashDirectoryObservations(observations),
      };

      const exit = yield* Effect.exit(SourceObservationStore.persistDirectorySnapshot(invalid));
      expect(Exit.isFailure(exit)).toBe(true);

      const runs = yield* database.drizzle
        .select({ id: sourceImportRuns.id, isCurrent: sourceImportRuns.isCurrent })
        .from(sourceImportRuns)
        .where(
          and(
            eq(sourceImportRuns.dataSourceId, "webuntis:rollback-test"),
            eq(sourceImportRuns.dataset, "directory"),
          ),
        );
      expect(runs).toEqual([{ id: imported.runId, isCurrent: true }]);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
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

it.live.runIf(hasContainerRuntime)(
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

it.live.runIf(hasContainerRuntime)(
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
