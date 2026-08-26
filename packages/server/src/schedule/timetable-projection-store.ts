import { Importing, Organization, Schedule } from "@stu/core";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { Database } from "../database/client.ts";
import { sha256Json } from "../cryptography/content-hash.ts";
import { EntityLinks } from "../importing/entity-links.ts";
import { sourceImportRuns, sourceRecords, sourceRecordVersions } from "../importing/schema.ts";
import { courseOccurrenceAssignments } from "../organization/course-schema.ts";
import { projectTimetableOccurrences } from "../webuntis/timetable-projection.ts";
import { TimetableObservation } from "../webuntis/timetable.ts";
import {
  timetableOccurrences,
  timetableOccurrenceSources,
  timetableProjectionChanges,
  timetableProjectionRuns,
} from "./schema.ts";

export class TimetableSourceScopeUnavailable extends Schema.TaggedError<TimetableSourceScopeUnavailable>()(
  "Schedule.TimetableSourceScopeUnavailable",
  { dataSourceId: Schema.String, scope: Schema.String },
) {}

export class InvalidTimetableSourceRecord extends Schema.TaggedError<InvalidTimetableSourceRecord>()(
  "Schedule.InvalidTimetableSourceRecord",
  {
    sourceRecordVersionId: Schema.String,
    externalId: Schema.String,
    reason: Schema.String,
  },
) {}

export class MissingTimetableClaimSource extends Schema.TaggedError<MissingTimetableClaimSource>()(
  "Schedule.MissingTimetableClaimSource",
  { occurrenceId: Schema.String, externalId: Schema.String },
) {}

export class InvalidStoredTimetableOccurrence extends Schema.TaggedError<InvalidStoredTimetableOccurrence>()(
  "Schedule.InvalidStoredTimetableOccurrence",
  { occurrenceId: Schema.String, reason: Schema.String },
) {}

export interface ProjectCurrentTimetableScopeInput {
  readonly dataSourceId: string;
  readonly scope: string;
}

export interface ReadCurrentTimetableInput {
  readonly dataSourceId: Importing.DataSourceId;
  readonly start?: string;
  readonly end?: string;
}

interface PreparedOccurrence {
  readonly occurrence: Schedule.ProviderBackedOccurrence;
  readonly payload: Schema.Json;
  readonly contentHash: string;
  readonly sourceRecordVersionIds: ReadonlyArray<string>;
}

interface CurrentOccurrence {
  readonly id: string;
  readonly contentHash: string;
  readonly sourceRecordVersionIds: ReadonlyArray<string>;
}

interface ProjectionPlan {
  readonly added: ReadonlyArray<PreparedOccurrence>;
  readonly updated: ReadonlyArray<PreparedOccurrence>;
  readonly removed: ReadonlyArray<CurrentOccurrence>;
  readonly relinked: ReadonlyArray<PreparedOccurrence>;
  readonly unchanged: ReadonlyArray<PreparedOccurrence>;
}

const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const planProjection = (
  incoming: ReadonlyArray<PreparedOccurrence>,
  current: ReadonlyArray<CurrentOccurrence>,
): ProjectionPlan => {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const incomingIds = new Set<string>(incoming.map((item) => item.occurrence.id));
  const added: Array<PreparedOccurrence> = [];
  const updated: Array<PreparedOccurrence> = [];
  const relinked: Array<PreparedOccurrence> = [];
  const unchanged: Array<PreparedOccurrence> = [];

  for (const item of incoming) {
    const previous = currentById.get(item.occurrence.id);
    if (previous === undefined) {
      added.push(item);
    } else if (previous.contentHash !== item.contentHash) {
      updated.push(item);
    } else if (!sameStrings(previous.sourceRecordVersionIds, item.sourceRecordVersionIds)) {
      relinked.push(item);
    } else {
      unchanged.push(item);
    }
  }

  return {
    added,
    updated,
    relinked,
    unchanged,
    removed: current.filter((item) => !incomingIds.has(item.id)),
  };
};

const decodeSourceRecord = (row: {
  readonly externalId: string;
  readonly currentVersionId: string;
  readonly payload: Schema.Json;
}) =>
  Schema.decodeUnknownEffect(TimetableObservation)({
    _tag: "TimetableOccurrence",
    externalId: row.externalId,
    payload: row.payload,
  }).pipe(
    Effect.mapError((error) =>
      InvalidTimetableSourceRecord.make({
        sourceRecordVersionId: row.currentVersionId,
        externalId: row.externalId,
        reason: String(error),
      }),
    ),
  );

const prepareOccurrences = Effect.fnUntraced(function* (
  dataSourceId: Importing.DataSourceId,
  rows: ReadonlyArray<{
    readonly externalId: string;
    readonly currentVersionId: string;
    readonly payload: Schema.Json;
  }>,
  entityLinks: ReadonlyArray<Importing.EntityLink>,
  courseOfferingIdsByOccurrence: ReadonlyMap<string, ReadonlyArray<string>>,
) {
  const observations = yield* Effect.forEach(rows, decodeSourceRecord);
  const occurrences = yield* projectTimetableOccurrences({
    dataSourceId,
    observations,
    entityLinks,
  });
  const versionByExternalId = new Map(rows.map((row) => [row.externalId, row.currentVersionId]));

  return yield* Effect.forEach(occurrences, (projectedOccurrence) =>
    Effect.gen(function* () {
      const occurrence = Schedule.ProviderBackedOccurrence.make({
        id: projectedOccurrence.id,
        dataSourceId: projectedOccurrence.dataSourceId,
        date: projectedOccurrence.date,
        providerEntryIds: projectedOccurrence.providerEntryIds,
        recurringMeetingId: projectedOccurrence.recurringMeetingId,
        courseOfferingIds: (courseOfferingIdsByOccurrence.get(projectedOccurrence.id) ?? []).map(
          (id) => Organization.CourseOfferingId.make(id),
        ),
        bellPeriodId: projectedOccurrence.bellPeriodId,
        claims: projectedOccurrence.claims,
      });
      const sourceRecordVersionIds: Array<string> = [];
      for (const claim of occurrence.claims) {
        const sourceRecordVersionId = versionByExternalId.get(claim.source.externalId);
        if (sourceRecordVersionId === undefined) {
          return yield* MissingTimetableClaimSource.make({
            occurrenceId: occurrence.id,
            externalId: claim.source.externalId,
          });
        }
        sourceRecordVersionIds.push(sourceRecordVersionId);
      }
      sourceRecordVersionIds.sort();
      const payload = yield* Schema.encodeEffect(Schedule.ProviderBackedOccurrence)(occurrence);
      return {
        occurrence,
        payload,
        contentHash: yield* sha256Json(payload),
        sourceRecordVersionIds,
      } satisfies PreparedOccurrence;
    }),
  );
});

/** Replays one current daily source scope and reconciles only its affected occurrences. */
export const projectCurrentScope = Effect.fn("Schedule.projectCurrentTimetableScope")(function* (
  input: ProjectCurrentTimetableScopeInput,
) {
  const database = yield* Database.Service;
  const dataSourceId = yield* Schema.decodeEffect(Importing.DataSourceId)(input.dataSourceId);
  const entityLinks = yield* EntityLinks.readForDataSource(dataSourceId);
  const lockKey = JSON.stringify([dataSourceId, "timetable", input.scope]);

  return yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      yield* transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );

      const sourceRuns = yield* transaction
        .select({ id: sourceImportRuns.id })
        .from(sourceImportRuns)
        .where(
          and(
            eq(sourceImportRuns.dataSourceId, dataSourceId),
            eq(sourceImportRuns.dataset, "timetable"),
            eq(sourceImportRuns.scope, input.scope),
            eq(sourceImportRuns.isCurrent, true),
          ),
        )
        .limit(1);
      const sourceRun = sourceRuns[0];
      if (sourceRun === undefined) {
        return yield* TimetableSourceScopeUnavailable.make(input);
      }

      const sourceRows = yield* transaction
        .select({
          externalId: sourceRecords.externalId,
          currentVersionId: sourceRecords.currentVersionId,
          payload: sourceRecordVersions.payload,
        })
        .from(sourceRecords)
        .innerJoin(
          sourceRecordVersions,
          eq(sourceRecordVersions.id, sourceRecords.currentVersionId),
        )
        .where(
          and(
            eq(sourceRecords.dataSourceId, dataSourceId),
            eq(sourceRecords.dataset, "timetable"),
            eq(sourceRecords.scope, input.scope),
            eq(sourceRecords.entityKind, "TimetableOccurrence"),
            eq(sourceRecords.active, true),
          ),
        );
      const courseAssignmentRows = yield* transaction
        .select({
          occurrenceId: courseOccurrenceAssignments.occurrenceId,
          courseOfferingId: courseOccurrenceAssignments.courseOfferingId,
        })
        .from(courseOccurrenceAssignments)
        .where(eq(courseOccurrenceAssignments.dataSourceId, dataSourceId));
      const courseOfferingIdsByOccurrence = new Map<string, Array<string>>();
      for (const row of courseAssignmentRows) {
        const ids = courseOfferingIdsByOccurrence.get(row.occurrenceId) ?? [];
        ids.push(row.courseOfferingId);
        courseOfferingIdsByOccurrence.set(row.occurrenceId, ids);
      }
      for (const ids of courseOfferingIdsByOccurrence.values()) ids.sort();
      const incoming = yield* prepareOccurrences(
        dataSourceId,
        sourceRows,
        entityLinks,
        courseOfferingIdsByOccurrence,
      );

      const currentRows = yield* transaction
        .select({ id: timetableOccurrences.id, contentHash: timetableOccurrences.contentHash })
        .from(timetableOccurrences)
        .where(
          and(
            eq(timetableOccurrences.dataSourceId, dataSourceId),
            eq(timetableOccurrences.scope, input.scope),
          ),
        );
      const currentSourceRows =
        currentRows.length === 0
          ? []
          : yield* transaction
              .select({
                occurrenceId: timetableOccurrenceSources.occurrenceId,
                sourceRecordVersionId: timetableOccurrenceSources.sourceRecordVersionId,
              })
              .from(timetableOccurrenceSources)
              .where(
                inArray(
                  timetableOccurrenceSources.occurrenceId,
                  currentRows.map((row) => row.id),
                ),
              );
      const currentSources = new Map<string, Array<string>>();
      for (const row of currentSourceRows) {
        const sources = currentSources.get(row.occurrenceId) ?? [];
        sources.push(row.sourceRecordVersionId);
        currentSources.set(row.occurrenceId, sources);
      }
      const current = currentRows.map((row) => ({
        ...row,
        sourceRecordVersionIds: (currentSources.get(row.id) ?? []).sort(),
      }));
      const plan = planProjection(incoming, current);
      const changedCount =
        plan.added.length + plan.updated.length + plan.removed.length + plan.relinked.length;

      const insertedRuns = yield* transaction
        .insert(timetableProjectionRuns)
        .values({
          dataSourceId,
          scope: input.scope,
          sourceRunId: sourceRun.id,
          outcome: changedCount === 0 ? "Unchanged" : "Changed",
          occurrenceCount: incoming.length,
          addedCount: plan.added.length,
          updatedCount: plan.updated.length,
          removedCount: plan.removed.length,
          relinkedCount: plan.relinked.length,
        })
        .returning({
          id: timetableProjectionRuns.id,
          projectedAt: timetableProjectionRuns.projectedAt,
        });
      const projectionRun = insertedRuns[0];
      if (projectionRun === undefined) {
        return yield* Effect.die("PostgreSQL did not return the timetable projection run");
      }

      if (plan.added.length > 0) {
        yield* transaction.insert(timetableOccurrences).values(
          plan.added.map((item) => ({
            id: item.occurrence.id,
            dataSourceId,
            scope: input.scope,
            date: PlainDate.toString(item.occurrence.date),
            contentHash: item.contentHash,
            payload: item.payload,
          })),
        );
      }
      for (const item of plan.updated) {
        yield* transaction
          .update(timetableOccurrences)
          .set({
            date: PlainDate.toString(item.occurrence.date),
            contentHash: item.contentHash,
            payload: item.payload,
            updatedAt: sql`now()`,
          })
          .where(eq(timetableOccurrences.id, item.occurrence.id));
      }

      const requiringSources = [...plan.added, ...plan.updated, ...plan.relinked];
      if (requiringSources.length > 0) {
        const occurrenceIds = requiringSources.map((item) => item.occurrence.id);
        yield* transaction
          .delete(timetableOccurrenceSources)
          .where(inArray(timetableOccurrenceSources.occurrenceId, occurrenceIds));
        yield* transaction.insert(timetableOccurrenceSources).values(
          requiringSources.flatMap((item) =>
            item.sourceRecordVersionIds.map((sourceRecordVersionId) => ({
              occurrenceId: item.occurrence.id,
              sourceRecordVersionId,
            })),
          ),
        );
      }
      if (plan.removed.length > 0) {
        yield* transaction.delete(timetableOccurrences).where(
          inArray(
            timetableOccurrences.id,
            plan.removed.map((item) => item.id),
          ),
        );
      }

      const changes: Array<typeof timetableProjectionChanges.$inferInsert> = [
        ...plan.added.map((item) => ({
          projectionRunId: projectionRun.id,
          occurrenceId: item.occurrence.id,
          changeType: "Added" as const,
          beforeContentHash: null,
          afterContentHash: item.contentHash,
        })),
        ...plan.updated.map((item) => ({
          projectionRunId: projectionRun.id,
          occurrenceId: item.occurrence.id,
          changeType: "Updated" as const,
          beforeContentHash: current.find((value) => value.id === item.occurrence.id)?.contentHash,
          afterContentHash: item.contentHash,
        })),
        ...plan.removed.map((item) => ({
          projectionRunId: projectionRun.id,
          occurrenceId: item.id,
          changeType: "Removed" as const,
          beforeContentHash: item.contentHash,
          afterContentHash: null,
        })),
        ...plan.relinked.map((item) => ({
          projectionRunId: projectionRun.id,
          occurrenceId: item.occurrence.id,
          changeType: "Relinked" as const,
          beforeContentHash: item.contentHash,
          afterContentHash: item.contentHash,
        })),
      ];
      if (changes.length > 0) {
        yield* transaction.insert(timetableProjectionChanges).values(changes);
      }

      return {
        _tag: changedCount === 0 ? "Unchanged" : "Projected",
        runId: projectionRun.id,
        sourceRunId: sourceRun.id,
        occurrenceCount: incoming.length,
        changes: {
          added: plan.added.length,
          updated: plan.updated.length,
          removed: plan.removed.length,
          relinked: plan.relinked.length,
        },
        projectedAt: projectionRun.projectedAt,
      } as const;
    }),
  );
});

/** Reads the server-only current projection. Authorization must happen before client delivery. */
export const readCurrent = Effect.fn("Schedule.readCurrentTimetable")(function* (
  input: ReadCurrentTimetableInput,
) {
  const database = yield* Database.Service;
  const conditions = [eq(timetableOccurrences.dataSourceId, input.dataSourceId)];
  if (input.start !== undefined) conditions.push(gte(timetableOccurrences.date, input.start));
  if (input.end !== undefined) conditions.push(lte(timetableOccurrences.date, input.end));
  const rows = yield* database.drizzle
    .select({ id: timetableOccurrences.id, payload: timetableOccurrences.payload })
    .from(timetableOccurrences)
    .where(and(...conditions))
    .orderBy(timetableOccurrences.date, timetableOccurrences.id);

  return yield* Effect.forEach(rows, (row) =>
    Schema.decodeUnknownEffect(Schedule.ProviderBackedOccurrence)(row.payload).pipe(
      Effect.mapError((error) =>
        InvalidStoredTimetableOccurrence.make({ occurrenceId: row.id, reason: String(error) }),
      ),
    ),
  );
});

export * as TimetableProjectionStore from "./timetable-projection-store.ts";
