import { Importing, Organization } from "@stu/core";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { afterAll, beforeAll, expect, it } from "@effect/vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { and, count, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { Auth } from "../auth/better-auth.ts";
import { Operator } from "../access/operator.ts";
import { SchoolAccess } from "../access/school-access.ts";
import { schoolAccessCodes } from "../access/schema.ts";
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
import {
  hashSourceObservations as hashSourceObservationsEffect,
  type SourceRecordObservation,
  type SourceSnapshot,
} from "../importing/source-snapshot.ts";
import { runCrypto } from "../cryptography/testing.ts";
import { DirectoryProjectionStore } from "../organization/directory-projection-store.ts";
import { CourseProjectionStore } from "../organization/course-projection-store.ts";
import {
  courseAnnualObservations,
  courseOfferings,
  courseProjectionRuns,
} from "../organization/course-schema.ts";
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
  hashDirectoryObservations as hashDirectoryObservationsEffect,
  type DirectorySnapshot,
} from "../webuntis/directory-snapshot.ts";
import { TimetableObservation } from "../webuntis/timetable.ts";
import { StudentTimetableObservation } from "../webuntis/student-timetable.ts";

const hashSourceObservations = (observations: ReadonlyArray<SourceRecordObservation>) =>
  runCrypto(hashSourceObservationsEffect(observations));
const hashDirectoryObservations = (observations: ReadonlyArray<DirectoryObservation>) =>
  runCrypto(hashDirectoryObservationsEffect(observations));

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
    Layer.mergeAll(
      NodeCrypto.layer,
      Layer.effectDiscard(migrateToLatest).pipe(
        Layer.provideMerge(
          Database.layer({ url: Redacted.make(connectionUri), maxConnections: 2 }),
        ),
      ),
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

const courseRosterObservation = (input: {
  readonly date: string;
  readonly entryId: number;
  readonly studentId: number;
  readonly courseCode: string;
}) => {
  const studentName = `Student ${input.studentId}`;
  return StudentTimetableObservation.make({
    _tag: "TimetableOccurrence",
    externalId: `STUDENT:${input.studentId}:${input.date}:${input.entryId}`,
    payload: {
      academicYearExternalId: "10",
      date: input.date,
      resource: {
        externalId: String(input.studentId),
        shortName: studentName,
        longName: studentName,
        displayName: studentName,
      },
      student: {
        student: {
          id: input.studentId,
          shortName: studentName,
          longName: studentName,
          displayName: studentName,
        },
        classes: [
          {
            class: {
              id: 565,
              shortName: "5.2",
              longName: "Klasse 5.2",
              displayName: "5.2",
            },
            dateRange: { start: "2026-08-13", end: "2027-07-07" },
            department: null,
          },
        ],
        assignmentGroups: [],
        imageUrl: null,
      },
      dayStatus: "REGULAR",
      location: "Grid",
      entry: {
        ids: [input.entryId],
        duration: { start: "08:00", end: "08:45" },
        type: "NORMAL_TEACHING_PERIOD",
        status: "REGULAR",
        layoutStartPosition: 0,
        layoutWidth: 1,
        layoutGroup: 0,
        color: "#ffffff",
        notesAll: "",
        icons: [],
        position1: [
          {
            current: {
              type: "SUBJECT",
              status: "REGULAR",
              shortName: input.courseCode,
              longName: input.courseCode,
              displayName: input.courseCode,
              displayNameLabel: null,
            },
            removed: null,
          },
        ],
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
};

const courseRosterSnapshot = (date: string, entryId: number, courseCode = "MA-E") => {
  const observations = [1, 2, 3, 4, 5].map((studentId) =>
    courseRosterObservation({ date, entryId, studentId, courseCode }),
  );
  return {
    provider: "WebUntis",
    dataSourceId: "webuntis:directory-projection-test",
    dataset: "course-rosters",
    scope: `academic-year:10/resource-type:STUDENT/date:${date}`,
    contentHash: hashSourceObservations(observations),
    completeness: "Complete",
    observations,
    counts: { privateOccurrenceViews: observations.length },
    diagnostics: [],
  } satisfies SourceSnapshot<StudentTimetableObservation>;
};

const courseTimetableSnapshot = (date: string, entryId: number) => {
  const observation = TimetableObservation.make({
    externalId: `CLASS:565:${date}:${entryId}`,
    payload: {
      academicYearExternalId: "10",
      date,
      resourceType: "CLASS",
      resource: {
        externalId: "565",
        shortName: "5.2",
        longName: "Klasse 5.2",
        displayName: "5.2",
      },
      dayStatus: "REGULAR",
      location: "Grid",
      entry: {
        ids: [entryId],
        duration: { start: "08:00", end: "08:45" },
        type: "NORMAL_TEACHING_PERIOD",
        status: "REGULAR",
        layoutStartPosition: 0,
        layoutWidth: 1,
        layoutGroup: 0,
        color: "#ffffff",
        notesAll: "",
        icons: [],
        position1: [
          {
            current: {
              type: "SUBJECT",
              status: "REGULAR",
              shortName: "MA-E",
              longName: "MA-E",
              displayName: "MA-E",
              displayNameLabel: null,
            },
            removed: null,
          },
        ],
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
  const observations = [observation];
  return {
    provider: "WebUntis",
    dataSourceId: "webuntis:directory-projection-test",
    dataset: "timetable",
    scope: `academic-year:10/resource-types:CLASS,SUBJECT,TEACHER,ROOM/date:${date}`,
    contentHash: hashSourceObservations(observations),
    completeness: "Complete",
    observations,
    counts: { occurrenceViews: observations.length },
    diagnostics: [],
  } satisfies SourceSnapshot<TimetableObservation>;
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
  "allocates course identities once and restores them after source evidence changes",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const rawDataSourceId = "webuntis:directory-projection-test";
      yield* SourceObservationStore.persistDirectorySnapshot(
        projectableDirectorySnapshot("IGS Lilienthal"),
      );
      yield* DirectoryProjectionStore.projectCurrent({ dataSourceId: rawDataSourceId });

      const days = [
        ["2026-08-24", 101],
        ["2026-08-31", 102],
        ["2026-09-07", 103],
      ] as const;
      yield* Effect.forEach(days, ([date, entryId]) =>
        Effect.gen(function* () {
          const snapshot = courseTimetableSnapshot(date, entryId);
          yield* SourceObservationStore.persistSourceSnapshot(snapshot);
          yield* TimetableProjectionStore.projectCurrentScope({
            dataSourceId: rawDataSourceId,
            scope: snapshot.scope,
          });
        }),
      );
      yield* Effect.forEach(days, ([date, entryId]) =>
        SourceObservationStore.persistSourceSnapshot(courseRosterSnapshot(date, entryId)),
      );

      const added = yield* CourseProjectionStore.projectCurrent({ dataSourceId: rawDataSourceId });
      const unchanged = yield* CourseProjectionStore.projectCurrent({
        dataSourceId: rawDataSourceId,
      });
      const initial = yield* CourseProjectionStore.readCurrent({ dataSourceId: rawDataSourceId });
      const initialOfferingId = initial.offerings[0]?.id;

      expect(added).toMatchObject({
        _tag: "Projected",
        annualObservationCount: 1,
        resolvedObservationCount: 1,
        createdOfferingCount: 1,
        occurrenceAssignmentCount: 3,
      });
      expect(unchanged).toMatchObject({
        _tag: "Unchanged",
        annualObservationCount: 1,
        createdOfferingCount: 0,
        changedCount: 0,
      });
      expect(initial.offerings).toHaveLength(1);
      expect(initial.academicYears).toMatchObject([
        { name: "MA-E", classGroupIds: ["igs-lilienthal/class/2026/2"] },
      ]);
      const linkedBeforeTimetableReplay = yield* TimetableProjectionStore.readCurrent({
        dataSourceId: Importing.DataSourceId.make(rawDataSourceId),
      });
      expect(linkedBeforeTimetableReplay).toHaveLength(3);
      expect(
        linkedBeforeTimetableReplay.every(
          (occurrence) => occurrence.courseOfferingIds[0] === initialOfferingId,
        ),
      ).toBe(true);
      const replayedScope = yield* TimetableProjectionStore.projectCurrentScope({
        dataSourceId: rawDataSourceId,
        scope: courseTimetableSnapshot("2026-08-24", 101).scope,
      });
      expect(replayedScope).toMatchObject({ _tag: "Unchanged" });

      yield* SourceObservationStore.persistSourceSnapshot(
        courseRosterSnapshot("2026-09-07", 103, "MA-G"),
      );
      const evidenceChanged = yield* CourseProjectionStore.projectCurrent({
        dataSourceId: rawDataSourceId,
      });
      expect(evidenceChanged).toMatchObject({
        _tag: "Projected",
        annualObservationCount: 0,
        createdOfferingCount: 0,
      });

      yield* SourceObservationStore.persistSourceSnapshot(courseRosterSnapshot("2026-09-07", 103));
      const restored = yield* CourseProjectionStore.projectCurrent({
        dataSourceId: rawDataSourceId,
      });
      const current = yield* CourseProjectionStore.readCurrent({ dataSourceId: rawDataSourceId });
      expect(restored).toMatchObject({
        _tag: "Projected",
        annualObservationCount: 1,
        resolvedObservationCount: 1,
        createdOfferingCount: 0,
      });
      expect(current.offerings.map((offering) => offering.id)).toEqual([initialOfferingId]);

      const [offeringCount, activeObservationCount, projectionRunCount] = yield* Effect.all([
        database.drizzle
          .select({ count: count() })
          .from(courseOfferings)
          .where(eq(courseOfferings.dataSourceId, rawDataSourceId)),
        database.drizzle
          .select({ count: count() })
          .from(courseAnnualObservations)
          .where(
            and(
              eq(courseAnnualObservations.dataSourceId, rawDataSourceId),
              eq(courseAnnualObservations.active, true),
            ),
          ),
        database.drizzle
          .select({ count: count() })
          .from(courseProjectionRuns)
          .where(eq(courseProjectionRuns.dataSourceId, rawDataSourceId)),
      ]);
      expect(offeringCount[0]?.count).toBe(1);
      expect(activeObservationCount[0]?.count).toBe(1);
      expect(projectionRunCount[0]?.count).toBe(4);
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
  "onboards an operator through the ordinary password recovery path",
  () => {
    let resetToken = "";
    return Effect.gen(function* () {
      const auth = yield* Auth.Service;
      const database = yield* Database.Service;
      const operator = yield* Operator.bootstrap({
        name: "  Initial Operator  ",
        email: "INITIAL-OPERATOR@example.test",
      });

      const [stored] = yield* database.drizzle
        .select({ name: users.name, email: users.email, emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, operator.userId));
      expect(stored).toEqual({
        name: "Initial Operator",
        email: "initial-operator@example.test",
        emailVerified: true,
      });
      expect(yield* Operator.isActive(operator.userId)).toBe(true);

      yield* Effect.promise(() =>
        auth.api.requestPasswordReset({
          body: {
            email: operator.email,
            redirectTo: "https://studienbuch.example/passwort-zuruecksetzen",
          },
        }),
      );
      expect(resetToken).not.toBe("");
      yield* Effect.promise(() =>
        auth.api.resetPassword({
          body: { newPassword: "correct-horse-battery", token: resetToken },
        }),
      );
      const signedIn = yield* Effect.promise(() =>
        auth.api.signInEmail({
          body: { email: operator.email, password: "correct-horse-battery" },
        }),
      );
      expect(signedIn.user.id).toBe(operator.userId);
    }).pipe(
      Effect.provide(
        Layer.provideMerge(
          Auth.layer({
            sendResetPassword: ({ token }) => Effect.sync(() => (resetToken = token)),
          }),
          migrated,
        ),
      ),
    );
  },
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
  "signs a user up through the very schema Better Auth is mapped onto",
  () =>
    Effect.gen(function* () {
      const auth = yield* Auth.Service;
      const database = yield* Database.Service;
      const operator = yield* Operator.bootstrap({
        name: "Test operator",
        email: "operator-auth@example.test",
      });
      const [code] = yield* SchoolAccess.generateCodes({
        schoolId: "auth-test-school",
        schoolName: "Auth Test School",
        kind: "Student",
        count: 1,
        createdByUserId: operator.userId,
      });
      if (code === undefined) return yield* Effect.die("Access-code generation returned no code");
      const reservation = yield* SchoolAccess.reserve(code);

      const result = yield* Effect.promise(() =>
        auth.api.signUpEmail({
          body: {
            email: "ada-auth@example.test",
            password: "correct-horse-battery",
            name: "  Ada Auth  ",
          },
          headers: new Headers({ "x-studienbuch-registration": reservation.token }),
        }),
      );
      expect(result.user.email).toBe("ada-auth@example.test");
      expect(result.user.name).toBe("Ada Auth");
      const granted = yield* Operator.grant(result.user.email);
      expect(granted.userId).toBe(result.user.id);
      expect(yield* Operator.isActive(result.user.id)).toBe(true);

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
    }).pipe(
      Effect.provide(
        Layer.provideMerge(
          Auth.layer({ emailVerification: { sendVerificationEmail: () => Effect.void } }),
          migrated,
        ),
      ),
    ),
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
  "lets one reservation create a bounded number of accounts",
  () =>
    Effect.gen(function* () {
      const operator = yield* Operator.bootstrap({
        name: "Budget operator",
        email: "operator-budget@example.test",
      });
      const [code] = yield* SchoolAccess.generateCodes({
        schoolId: "budget-test-school",
        schoolName: "Budget Test School",
        kind: "Student",
        count: 1,
        createdByUserId: operator.userId,
      });
      if (code === undefined) return yield* Effect.die("Access-code generation returned no code");
      const reservation = yield* SchoolAccess.reserve(code);

      const claims = yield* Effect.all(
        Array.from({ length: SchoolAccess.reservationSignupBudget * 4 }, () =>
          SchoolAccess.claimRegistrationSignup(reservation.token),
        ),
        { concurrency: "unbounded" },
      );
      expect(claims.filter(Boolean)).toHaveLength(SchoolAccess.reservationSignupBudget);

      expect(yield* SchoolAccess.claimRegistrationSignup(reservation.token)).toBe(false);
      expect(yield* SchoolAccess.releaseRegistrationSignup(reservation.token)).toBe(true);
      expect(yield* SchoolAccess.claimRegistrationSignup(reservation.token)).toBe(true);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);

it.live.runIf(hasContainerRuntime)(
  "reserves an unassigned code once and redeems it only for a verified account",
  () =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const operator = yield* Operator.bootstrap({
        name: "Enrollment operator",
        email: "operator-enrollment@example.test",
      });
      const [code] = yield* SchoolAccess.generateCodes({
        schoolId: "enrollment-test-school",
        schoolName: "Enrollment Test School",
        kind: "Student",
        count: 1,
        createdByUserId: operator.userId,
      });
      if (code === undefined) return yield* Effect.die("Access-code generation returned no code");
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);

      const reservation = yield* SchoolAccess.reserve(code.toLowerCase());
      const secondReservation = yield* Effect.flip(SchoolAccess.reserve(code));
      expect(secondReservation._tag).toBe("SchoolAccess.CodeUnavailable");

      const [user] = yield* database.drizzle
        .insert(users)
        .values({ name: "Student", email: "student-access@example.test" })
        .returning({ id: users.id });
      if (user === undefined) return yield* Effect.die("User insert returned no row");

      const unverified = yield* Effect.flip(
        SchoolAccess.completeReservation(user.id, reservation.token),
      );
      expect(unverified._tag).toBe("SchoolAccess.EmailNotVerified");
      yield* database.drizzle
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, user.id));
      const access = yield* SchoolAccess.completeReservation(user.id, reservation.token);
      expect(access).toMatchObject({
        school: { id: "enrollment-test-school", name: "Enrollment Test School" },
        kind: "Student",
      });
      const retriedAccess = yield* SchoolAccess.completeReservation(user.id, reservation.token);
      expect(retriedAccess.id).toBe(access.id);
      expect(yield* SchoolAccess.claimRegistrationSignup(reservation.token)).toBe(false);
      yield* SchoolAccess.saveProfile(user.id, {
        schoolAccessId: Organization.SchoolAccessId.make(access.id),
        cohort: "8",
        className: "8a",
      });
      const listed = yield* SchoolAccess.listForUser(user.id);
      expect(listed).toMatchObject([
        { profileId: access.id, cohort: "8", className: "8a", kind: "Student" },
      ]);

      const stored = yield* database.drizzle
        .select({ secretHash: schoolAccessCodes.secretHash })
        .from(schoolAccessCodes)
        .where(eq(schoolAccessCodes.schoolId, "enrollment-test-school"));
      expect(stored.map((row) => row.secretHash)).not.toContain(code);
    }).pipe(Effect.provide(migrated)),
  { timeout: 60_000 },
);
