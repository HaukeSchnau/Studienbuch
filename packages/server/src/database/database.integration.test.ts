import { Importing, Organization } from "@stu/core";
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
import {
  sourceChanges,
  sourceImportRuns,
  sourceRecords,
  sourceRecordVersions,
} from "../importing/schema.ts";
import { EntityLinks as EntityLinkStore } from "../importing/entity-links.ts";
import { SourceObservationStore } from "../importing/source-observation-store.ts";
import { hashSourceObservations, type SourceSnapshot } from "../importing/source-snapshot.ts";
import { DirectoryProjectionStore } from "../organization/directory-projection-store.ts";
import {
  directoryEntities,
  directoryEntitySources,
  directoryProjectionChanges,
  directoryProjectionRuns,
  directoryProjectionRunSources,
} from "../organization/schema.ts";
import {
  timetableOccurrences,
  timetableOccurrenceSources,
  timetableProjectionChanges,
  timetableProjectionRuns,
} from "../schedule/schema.ts";
import { TimetableProjectionStore } from "../schedule/timetable-projection-store.ts";
import { DirectoryPreview } from "../webuntis/directory-preview.ts";
import {
  DirectoryObservation,
  hashDirectoryObservations,
  type DirectorySnapshot,
} from "../webuntis/directory-snapshot.ts";
import { TimetableObservation } from "../webuntis/timetable.ts";

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

const sourceSnapshot = (
  dataSourceId: string,
  observations: ReadonlyArray<DirectoryObservation>,
  completeness: "Complete" | "Partial" = "Complete",
): SourceSnapshot<DirectoryObservation> => ({
  provider: "WebUntis",
  dataSourceId,
  dataset: "test-records",
  scope: "scope-1",
  contentHash: hashDirectoryObservations(observations),
  completeness,
  observations,
  counts: { observations: observations.length },
  diagnostics: [],
});

const projectableDirectorySnapshot = (
  schoolName: string,
  includeClass = true,
): DirectorySnapshot => {
  const className = "5.2";
  const observations = [
    DirectoryObservation.make({
      _tag: "School",
      externalId: "tenant-igs",
      payload: { name: schoolName, loginName: "igs-lilienthal", hostName: null },
    }),
    DirectoryObservation.make({
      _tag: "AcademicYear",
      externalId: "10",
      payload: { name: "2026/2027", start: "2026-08-13", end: "2027-07-07" },
    }),
    ...(!includeClass
      ? []
      : [
          DirectoryObservation.make({
            _tag: "ClassGroup",
            externalId: "565",
            payload: {
              shortName: className,
              longName: `Klasse ${className}`,
              displayName: className,
              academicYearExternalId: "10",
              departmentExternalId: null,
              classTeachers: { firstExternalId: null, secondExternalId: null },
            },
          }),
        ]),
  ];
  return {
    preview: DirectoryPreview.make({
      dataSourceId: "webuntis:directory-projection-test",
      provider: "WebUntis",
      school: { externalId: "tenant-igs", name: schoolName, loginName: "igs-lilienthal" },
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
        academicYears: 1,
        departments: 0,
        buildings: 0,
        rooms: 0,
        classes: includeClass ? 1 : 0,
        teachers: 0,
        students: 0,
        activities: 0,
        holidays: 0,
        bellPeriods: 0,
      },
      ignored: { studentImages: 0, teacherImages: 0, assignmentGroups: 0 },
      diagnostics: [],
    }),
    observations,
    contentHash: hashDirectoryObservations(observations),
  };
};

const schoolObservation = (externalId: string, name: string) =>
  DirectoryObservation.make({
    _tag: "School",
    externalId,
    payload: { name, loginName: name.toLowerCase(), hostName: null },
  });

const timetableScope = "academic-year:10/resource-types:CLASS,SUBJECT,TEACHER,ROOM/date:2026-08-24";

const timetableObservation = (status: string) =>
  TimetableObservation.make({
    externalId: "CLASS:1:2026-08-24:101",
    payload: {
      academicYearExternalId: "10",
      date: "2026-08-24",
      resourceType: "CLASS",
      resource: {
        externalId: "1",
        shortName: "5.2",
        longName: "Klasse 5.2",
        displayName: "5.2",
      },
      dayStatus: "REGULAR",
      location: "Grid",
      entry: {
        ids: [101],
        duration: { start: "08:00", end: "08:45" },
        type: "NORMAL_TEACHING_PERIOD",
        status,
        layoutStartPosition: 0,
        layoutWidth: 1,
        layoutGroup: 0,
        color: "#ffffff",
        notesAll: "",
        icons: [],
        position1: [],
        position2: [],
        position3: [],
        position4: [],
        texts: [],
        lessonText: "",
        lessonInfo: null,
        substitutionText: "",
      },
    },
  });

const timetableSnapshot = (
  dataSourceId: string,
  observations: ReadonlyArray<TimetableObservation>,
): SourceSnapshot<TimetableObservation> => ({
  provider: "WebUntis",
  dataSourceId,
  dataset: "timetable",
  scope: timetableScope,
  contentHash: hashSourceObservations(observations),
  completeness: "Complete",
  observations,
  counts: { occurrenceViews: observations.length },
  diagnostics: [],
});

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
  "stores only changed record versions across concurrent and repeated imports",
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

      expect(first).toMatchObject({ _tag: "Imported", changes: { added: 1 } });
      expect(repeated).toMatchObject({ _tag: "Unchanged" });
      expect(repeated.runId).not.toBe(first.runId);
      expect(changed).toMatchObject({ _tag: "Imported", changes: { updated: 1 } });
      expect(changed.runId).not.toBe(first.runId);

      const runs = yield* database.drizzle
        .select({ id: sourceImportRuns.id, isCurrent: sourceImportRuns.isCurrent })
        .from(sourceImportRuns)
        .where(eq(sourceImportRuns.dataSourceId, "webuntis:store-test"));
      const versions = yield* database.drizzle
        .select({ count: count() })
        .from(sourceRecordVersions)
        .where(eq(sourceRecordVersions.dataSourceId, "webuntis:store-test"));
      const changes = yield* database.drizzle
        .select({ count: count() })
        .from(sourceChanges)
        .innerJoin(sourceImportRuns, eq(sourceImportRuns.id, sourceChanges.runId))
        .where(eq(sourceImportRuns.dataSourceId, "webuntis:store-test"));

      expect(runs).toHaveLength(3);
      expect(runs.filter((run) => run.isCurrent)).toEqual([{ id: changed.runId, isCurrent: true }]);
      expect(versions[0]?.count).toBe(2);
      expect(changes[0]?.count).toBe(2);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
  "removes records only from complete scopes and reactivates old versions without copying them",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const firstSchool = schoolObservation("school-1", "First");
      const secondSchool = schoolObservation("school-2", "Second");
      const initial = sourceSnapshot("webuntis:lifecycle-test", [firstSchool, secondSchool]);

      const added = yield* SourceObservationStore.persistSourceSnapshot(initial);
      const partial = yield* SourceObservationStore.persistSourceSnapshot(
        sourceSnapshot("webuntis:lifecycle-test", [firstSchool], "Partial"),
      );
      const removed = yield* SourceObservationStore.persistSourceSnapshot(
        sourceSnapshot("webuntis:lifecycle-test", [firstSchool]),
      );
      const reactivated = yield* SourceObservationStore.persistSourceSnapshot(initial);

      expect(added.changes).toMatchObject({ added: 2 });
      expect(partial.changes).toMatchObject({ removed: 0 });
      expect(removed.changes).toMatchObject({ removed: 1 });
      expect(reactivated.changes).toMatchObject({ reactivated: 1 });

      const versions = yield* database.drizzle
        .select({ count: count() })
        .from(sourceRecordVersions)
        .where(eq(sourceRecordVersions.dataSourceId, "webuntis:lifecycle-test"));
      const records = yield* database.drizzle
        .select({ active: sourceRecords.active })
        .from(sourceRecords)
        .where(eq(sourceRecords.dataSourceId, "webuntis:lifecycle-test"));
      const changes = yield* database.drizzle
        .select({ changeType: sourceChanges.changeType })
        .from(sourceChanges)
        .innerJoin(sourceImportRuns, eq(sourceImportRuns.id, sourceChanges.runId))
        .where(eq(sourceImportRuns.dataSourceId, "webuntis:lifecycle-test"));

      expect(versions[0]?.count).toBe(2);
      expect(records).toEqual([{ active: true }, { active: true }]);
      expect(changes.map((change) => change.changeType).sort()).toEqual([
        "Added",
        "Added",
        "Reactivated",
        "Removed",
      ]);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
  "replays all current directory scopes into canonical entities with exact provenance",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const rawDataSourceId = "webuntis:directory-projection-test";
      const dataSourceId = Importing.DataSourceId.make(rawDataSourceId);

      yield* SourceObservationStore.persistDirectorySnapshot(
        projectableDirectorySnapshot("IGS Lilienthal"),
      );
      const added = yield* DirectoryProjectionStore.projectCurrent({
        dataSourceId: rawDataSourceId,
      });
      const unchanged = yield* DirectoryProjectionStore.projectCurrent({
        dataSourceId: rawDataSourceId,
      });

      expect(added).toMatchObject({
        _tag: "Projected",
        schoolId: "igs-lilienthal",
        entityCount: 4,
        changes: { added: 4, updated: 0, removed: 0, relinked: 0 },
      });
      expect(unchanged).toMatchObject({ _tag: "Unchanged" });
      const initial = yield* DirectoryProjectionStore.readCurrent({ dataSourceId });
      expect(initial.map((entity) => entity._tag)).toEqual([
        "AcademicYear",
        "ClassGroup",
        "ClassGroupAcademicYear",
        "School",
      ]);

      yield* SourceObservationStore.persistDirectorySnapshot(
        projectableDirectorySnapshot("IGS Lilienthal Schule"),
      );
      const updated = yield* DirectoryProjectionStore.projectCurrent({
        dataSourceId: rawDataSourceId,
      });
      expect(updated).toMatchObject({ changes: { added: 0, updated: 1, removed: 0 } });

      yield* SourceObservationStore.persistDirectorySnapshot(
        projectableDirectorySnapshot("IGS Lilienthal Schule", false),
      );
      const removed = yield* DirectoryProjectionStore.projectCurrent({
        dataSourceId: rawDataSourceId,
      });
      expect(removed).toMatchObject({
        entityCount: 2,
        changes: { added: 0, updated: 0, removed: 2, relinked: 0 },
      });

      const entityRows = yield* database.drizzle
        .select({ count: count() })
        .from(directoryEntities)
        .where(eq(directoryEntities.dataSourceId, rawDataSourceId));
      const sourceRows = yield* database.drizzle
        .select({ count: count() })
        .from(directoryEntitySources)
        .innerJoin(directoryEntities, eq(directoryEntities.key, directoryEntitySources.entityKey))
        .where(eq(directoryEntities.dataSourceId, rawDataSourceId));
      const projectionRuns = yield* database.drizzle
        .select({ id: directoryProjectionRuns.id })
        .from(directoryProjectionRuns)
        .where(eq(directoryProjectionRuns.dataSourceId, rawDataSourceId));
      const runSources = yield* database.drizzle
        .select({ count: count() })
        .from(directoryProjectionRunSources)
        .innerJoin(
          directoryProjectionRuns,
          eq(directoryProjectionRuns.id, directoryProjectionRunSources.projectionRunId),
        )
        .where(eq(directoryProjectionRuns.dataSourceId, rawDataSourceId));
      const changes = yield* database.drizzle
        .select({ changeType: directoryProjectionChanges.changeType })
        .from(directoryProjectionChanges)
        .innerJoin(
          directoryProjectionRuns,
          eq(directoryProjectionRuns.id, directoryProjectionChanges.projectionRunId),
        )
        .where(eq(directoryProjectionRuns.dataSourceId, rawDataSourceId));

      expect(entityRows[0]?.count).toBe(2);
      expect(sourceRows[0]?.count).toBe(2);
      expect(projectionRuns).toHaveLength(4);
      expect(runSources[0]?.count).toBe(4);
      expect(changes.map((change) => change.changeType)).toEqual(
        expect.arrayContaining(["Added", "Updated", "Removed"]),
      );
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
  "replays current timetable records into a linked projection and removes only the affected scope",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const rawDataSourceId = "webuntis:timetable-projection-test";
      const dataSourceId = Importing.DataSourceId.make(rawDataSourceId);
      const academicYearSource = Importing.SourceIdentity.make({
        dataSourceId,
        entityKind: "AcademicYear",
        externalId: Importing.ExternalId.make("10"),
      });
      const classSource = Importing.SourceIdentity.make({
        dataSourceId,
        entityKind: "ClassGroup",
        externalId: Importing.ExternalId.make("1"),
      });
      yield* Effect.all(
        [
          EntityLinkStore.put(
            Importing.EntityLink.cases.AcademicYear.make({
              source: academicYearSource,
              academicYearId: Organization.AcademicYearId.make("2026-2027"),
            }),
          ),
          EntityLinkStore.put(
            Importing.EntityLink.cases.ClassGroup.make({
              source: classSource,
              classGroupId: Organization.ClassGroupId.make("paula-2"),
            }),
          ),
        ],
        { concurrency: 2 },
      );

      yield* SourceObservationStore.persistSourceSnapshot(
        timetableSnapshot(rawDataSourceId, [timetableObservation("REGULAR")]),
      );
      const added = yield* TimetableProjectionStore.projectCurrentScope({
        dataSourceId: rawDataSourceId,
        scope: timetableScope,
      });
      const unchanged = yield* TimetableProjectionStore.projectCurrentScope({
        dataSourceId: rawDataSourceId,
        scope: timetableScope,
      });
      const projected = yield* TimetableProjectionStore.readCurrent({ dataSourceId });

      expect(added).toMatchObject({
        _tag: "Projected",
        occurrenceCount: 1,
        changes: { added: 1, updated: 0, removed: 0, relinked: 0 },
      });
      expect(unchanged).toMatchObject({ _tag: "Unchanged" });
      expect(projected[0]?.claims[0]).toMatchObject({
        academicYear: {
          source: { externalId: "10" },
          entityLink: { _tag: "AcademicYear", academicYearId: "2026-2027" },
        },
        viewedResource: {
          source: { externalId: "1" },
          entityLink: { _tag: "ClassGroup", classGroupId: "paula-2" },
        },
        status: "REGULAR",
      });

      yield* SourceObservationStore.persistSourceSnapshot(
        timetableSnapshot(rawDataSourceId, [timetableObservation("CHANGED")]),
      );
      const updated = yield* TimetableProjectionStore.projectCurrentScope({
        dataSourceId: rawDataSourceId,
        scope: timetableScope,
      });
      expect(updated).toMatchObject({ changes: { added: 0, updated: 1, removed: 0 } });

      const currentRecord = yield* database.drizzle
        .select({ currentVersionId: sourceRecords.currentVersionId })
        .from(sourceRecords)
        .where(
          and(
            eq(sourceRecords.dataSourceId, rawDataSourceId),
            eq(sourceRecords.dataset, "timetable"),
            eq(sourceRecords.scope, timetableScope),
          ),
        );
      const projectedSources = yield* database.drizzle
        .select({ sourceRecordVersionId: timetableOccurrenceSources.sourceRecordVersionId })
        .from(timetableOccurrenceSources)
        .innerJoin(
          timetableOccurrences,
          eq(timetableOccurrences.id, timetableOccurrenceSources.occurrenceId),
        )
        .where(eq(timetableOccurrences.dataSourceId, rawDataSourceId));
      expect(projectedSources).toEqual([
        { sourceRecordVersionId: currentRecord[0]?.currentVersionId },
      ]);

      yield* SourceObservationStore.persistSourceSnapshot(timetableSnapshot(rawDataSourceId, []));
      const removed = yield* TimetableProjectionStore.projectCurrentScope({
        dataSourceId: rawDataSourceId,
        scope: timetableScope,
      });
      expect(removed).toMatchObject({
        occurrenceCount: 0,
        changes: { added: 0, updated: 0, removed: 1 },
      });
      expect(yield* TimetableProjectionStore.readCurrent({ dataSourceId })).toEqual([]);

      const occurrenceRows = yield* database.drizzle
        .select({ count: count() })
        .from(timetableOccurrences)
        .where(eq(timetableOccurrences.dataSourceId, rawDataSourceId));
      const projectionRuns = yield* database.drizzle
        .select({ id: timetableProjectionRuns.id })
        .from(timetableProjectionRuns)
        .where(eq(timetableProjectionRuns.dataSourceId, rawDataSourceId));
      const projectionChanges = yield* database.drizzle
        .select({ changeType: timetableProjectionChanges.changeType })
        .from(timetableProjectionChanges)
        .innerJoin(
          timetableProjectionRuns,
          eq(timetableProjectionRuns.id, timetableProjectionChanges.projectionRunId),
        )
        .where(eq(timetableProjectionRuns.dataSourceId, rawDataSourceId));

      expect(occurrenceRows[0]?.count).toBe(0);
      expect(projectionRuns).toHaveLength(4);
      expect(projectionChanges).toHaveLength(3);
      expect(projectionChanges.map((change) => change.changeType)).toEqual(
        expect.arrayContaining(["Added", "Updated", "Removed"]),
      );
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
  "rolls back the run, version, record and change when a transition write fails",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const valid = directorySnapshot("webuntis:rollback-test", "school-1", "Valid");
      const imported = yield* SourceObservationStore.persistDirectorySnapshot(valid);
      yield* Effect.promise(() =>
        database.pool.query(`
          create function fail_source_change() returns trigger language plpgsql as $$
          begin
            raise exception 'intentional source change failure';
          end
          $$;
          create trigger fail_source_change before insert on source_changes
          for each row execute function fail_source_change();
        `),
      );

      const exit = yield* Effect.exit(
        SourceObservationStore.persistDirectorySnapshot(
          directorySnapshot("webuntis:rollback-test", "school-1", "Changed"),
        ),
      );
      expect(Exit.isFailure(exit)).toBe(true);
      yield* Effect.promise(() =>
        database.pool.query(`
          drop trigger fail_source_change on source_changes;
          drop function fail_source_change();
        `),
      );

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
      const versions = yield* database.drizzle
        .select({ count: count() })
        .from(sourceRecordVersions)
        .where(eq(sourceRecordVersions.dataSourceId, "webuntis:rollback-test"));
      expect(versions[0]?.count).toBe(1);
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
