import { Importing, NonBlankText, Organization, Schedule } from "@stu/core";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { Database } from "../database/client.ts";
import { sha256Json } from "../cryptography/content-hash.ts";
import { entityLinks } from "../importing/schema.ts";
import { sourceImportRuns, sourceRecords, sourceRecordVersions } from "../importing/schema.ts";
import { timetableOccurrences, timetableOccurrenceSources } from "../schedule/schema.ts";
import {
  type ExistingCourseAssignment,
  resolveCourseIdentities,
} from "../webuntis/course-identity-resolution.ts";
import {
  AnnualCourseObservation,
  buildAnnualCourseObservations,
  CourseIdentityDecision,
} from "../webuntis/course-reconciliation.ts";
import { DirectoryObservation } from "../webuntis/directory-snapshot.ts";
import { findSchoolProfile } from "../webuntis/school-profile.ts";
import {
  courseRosterOccurrenceKey,
  projectCourseRosterObservations,
  StudentTimetableObservation,
} from "../webuntis/student-timetable.ts";
import { DirectoryEntity } from "./directory-entity.ts";
import { directoryEntities } from "./schema.ts";
import {
  courseAnnualObservations,
  courseAnnualObservationSources,
  courseIdentityDecisions,
  courseOccurrenceAssignments,
  courseOfferingAcademicYears,
  courseOfferings,
  courseProjectionRuns,
  courseProjectionRunSources,
} from "./course-schema.ts";

export class CourseRosterSourceUnavailable extends Schema.TaggedError<CourseRosterSourceUnavailable>()(
  "Organization.CourseRosterSourceUnavailable",
  { dataSourceId: Schema.String },
) {}

export class CourseDirectoryUnavailable extends Schema.TaggedError<CourseDirectoryUnavailable>()(
  "Organization.CourseDirectoryUnavailable",
  { dataSourceId: Schema.String, reason: Schema.String },
) {}

export class InvalidCourseProjectionRecord extends Schema.TaggedError<InvalidCourseProjectionRecord>()(
  "Organization.InvalidCourseProjectionRecord",
  { recordId: Schema.String, reason: Schema.String },
) {}

export interface ProjectCurrentCoursesInput {
  readonly dataSourceId: string;
}

const annualKey = (dataSourceId: string, observationId: string) =>
  JSON.stringify([dataSourceId, observationId]);

const decisionKey = (dataSourceId: string, leftId: string, rightId: string) =>
  JSON.stringify([dataSourceId, leftId, rightId]);

const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const decodeRosterSource = (row: { readonly externalId: string; readonly payload: Schema.Json }) =>
  Schema.decodeUnknownEffect(StudentTimetableObservation)({
    _tag: "TimetableOccurrence",
    externalId: row.externalId,
    payload: row.payload,
  }).pipe(
    Effect.mapError((error) =>
      InvalidCourseProjectionRecord.make({ recordId: row.externalId, reason: String(error) }),
    ),
  );

const decodeDirectorySource = (row: {
  readonly entityKind: string;
  readonly externalId: string;
  readonly payload: Schema.Json;
}) =>
  Schema.decodeUnknownEffect(DirectoryObservation)({
    _tag: row.entityKind,
    externalId: row.externalId,
    payload: row.payload,
  }).pipe(
    Effect.mapError((error) =>
      CourseDirectoryUnavailable.make({
        dataSourceId: "unknown",
        reason: `Invalid ${row.entityKind} ${row.externalId}: ${String(error)}`,
      }),
    ),
  );

const decodeOccurrence = (row: { readonly id: string; readonly payload: Schema.Json }) =>
  Schema.decodeUnknownEffect(Schedule.ProviderBackedOccurrence)(row.payload).pipe(
    Effect.mapError((error) =>
      InvalidCourseProjectionRecord.make({ recordId: row.id, reason: String(error) }),
    ),
  );

const decodeDirectoryEntity = (row: { readonly key: string; readonly payload: Schema.Json }) =>
  Schema.decodeUnknownEffect(DirectoryEntity)(row.payload).pipe(
    Effect.mapError((error) =>
      InvalidCourseProjectionRecord.make({ recordId: row.key, reason: String(error) }),
    ),
  );

const invalidProjection = (recordId: string) => (error: Schema.SchemaError) =>
  InvalidCourseProjectionRecord.make({ recordId, reason: String(error) });

const encodeAnnualObservation = (value: AnnualCourseObservation) =>
  Schema.encodeEffect(AnnualCourseObservation)(value).pipe(
    Effect.mapError(invalidProjection(value.id)),
  );

const encodeDecision = (value: CourseIdentityDecision) =>
  Schema.encodeEffect(CourseIdentityDecision)(value).pipe(
    Effect.mapError(invalidProjection(`${value.leftObservationId}/${value.rightObservationId}`)),
  );

const encodeAcademicYearRepresentation = (value: Organization.CourseOfferingAcademicYear) =>
  Schema.encodeEffect(Organization.CourseOfferingAcademicYear)(value).pipe(
    Effect.mapError(invalidProjection(`${value.courseOfferingId}/${value.academicYearId}`)),
  );

const encodeOccurrence = (value: Schedule.ProviderBackedOccurrence) =>
  Schema.encodeEffect(Schedule.ProviderBackedOccurrence)(value).pipe(
    Effect.mapError(invalidProjection(value.id)),
  );

/** Replays every current roster scope, then reconciles all observed academic years together. */
export const projectCurrent = Effect.fn("Organization.projectCurrentCourses")(function* (
  input: ProjectCurrentCoursesInput,
) {
  const database = yield* Database.Service;
  const dataSourceId = yield* Schema.decodeEffect(Importing.DataSourceId)(input.dataSourceId);
  const lockKey = JSON.stringify([dataSourceId, "course-projection"]);

  return yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      yield* transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );

      const sourceRuns = yield* transaction
        .select({ id: sourceImportRuns.id, dataset: sourceImportRuns.dataset })
        .from(sourceImportRuns)
        .where(
          and(
            eq(sourceImportRuns.dataSourceId, dataSourceId),
            eq(sourceImportRuns.isCurrent, true),
            inArray(sourceImportRuns.dataset, ["course-rosters", "directory", "timetable"]),
          ),
        );
      if (!sourceRuns.some((run) => run.dataset === "course-rosters")) {
        return yield* CourseRosterSourceUnavailable.make({ dataSourceId });
      }

      const rosterRows = yield* transaction
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
            eq(sourceRecords.dataset, "course-rosters"),
            eq(sourceRecords.entityKind, "TimetableOccurrence"),
            eq(sourceRecords.active, true),
          ),
        );
      const rosterSources = yield* Effect.forEach(rosterRows, decodeRosterSource);

      const directoryRows = yield* transaction
        .select({
          entityKind: sourceRecords.entityKind,
          externalId: sourceRecords.externalId,
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
            eq(sourceRecords.dataset, "directory"),
            eq(sourceRecords.active, true),
            inArray(sourceRecords.entityKind, ["School", "AcademicYear"]),
          ),
        );
      const directory = yield* Effect.forEach(directoryRows, decodeDirectorySource);
      const school = directory.find((item) => item._tag === "School");
      if (school === undefined) {
        return yield* CourseDirectoryUnavailable.make({
          dataSourceId,
          reason: "The current directory has no school observation",
        });
      }
      const profile = findSchoolProfile({
        externalId: school.externalId,
        name: school.payload.name,
        loginName: school.payload.loginName,
      });
      if (profile === undefined) {
        return yield* CourseDirectoryUnavailable.make({
          dataSourceId,
          reason: `No course reconciliation profile matches ${school.payload.loginName}`,
        });
      }
      const academicYears = directory
        .filter((item) => item._tag === "AcademicYear")
        .sort((left, right) => Order.String(left.payload.start, right.payload.start));
      const academicYearByExternalId = new Map(
        academicYears.map((item) => [item.externalId, item]),
      );

      const occurrenceRows = yield* transaction
        .select({ id: timetableOccurrences.id, payload: timetableOccurrences.payload })
        .from(timetableOccurrences)
        .where(eq(timetableOccurrences.dataSourceId, dataSourceId));
      const occurrences = yield* Effect.forEach(occurrenceRows, decodeOccurrence);
      const occurrenceByRosterKey = new Map(
        occurrences.map((occurrence) => [
          courseRosterOccurrenceKey(
            PlainDate.toString(occurrence.date),
            occurrence.providerEntryIds,
          ),
          occurrence,
        ]),
      );
      const occurrenceSourceRows =
        occurrenceRows.length === 0
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
                  occurrenceRows.map((row) => row.id),
                ),
              );
      const occurrenceSources = new Map<string, Array<string>>();
      for (const row of occurrenceSourceRows) {
        const values = occurrenceSources.get(row.occurrenceId) ?? [];
        values.push(row.sourceRecordVersionId);
        occurrenceSources.set(row.occurrenceId, values);
      }

      const rosterSourceVersion = new Map(
        rosterRows.map((row) => [row.externalId, row.currentVersionId]),
      );
      const dated = academicYears.flatMap((academicYear) =>
        projectCourseRosterObservations({
          observations: rosterSources.filter(
            (observation) => observation.payload.academicYearExternalId === academicYear.externalId,
          ),
          academicYearStart: Number(academicYear.payload.start.slice(0, 4)),
          profile,
          occurrences,
        }),
      );
      const datedById = new Map(dated.map((observation) => [observation.id, observation]));
      const annualPeriods = yield* Effect.forEach(academicYears, (academicYear) =>
        buildAnnualCourseObservations(
          dated.filter(
            (observation) => observation.academicYearExternalId === academicYear.externalId,
          ),
          profile.courseReconciliation,
        ).pipe(
          Effect.map((built) => ({
            academicYearExternalId: academicYear.externalId,
            startsOn: academicYear.payload.start,
            observations: built.observations,
          })),
        ),
      );
      const annual = annualPeriods.flatMap((period) => period.observations);
      const currentAnnualRows = yield* transaction
        .select()
        .from(courseAnnualObservations)
        .where(eq(courseAnnualObservations.dataSourceId, dataSourceId));
      const existingAssignments: Array<ExistingCourseAssignment> = currentAnnualRows.flatMap(
        (row) =>
          row.courseOfferingId === null
            ? []
            : [
                {
                  annualObservationId: row.observationId,
                  courseOfferingId: row.courseOfferingId,
                },
              ],
      );
      const resolution = resolveCourseIdentities({
        periods: annualPeriods,
        existingAssignments,
        policy: profile.courseReconciliation,
      });
      const retainedDecisions = resolution.decisions.filter(
        (decision) => decision._tag !== "Different",
      );

      const insertedRuns = yield* transaction
        .insert(courseProjectionRuns)
        .values({
          dataSourceId,
          ruleId: profile.courseReconciliation.ruleId,
          outcome: "Unchanged",
          annualObservationCount: annual.length,
          decisionCount: resolution.decisions.length,
          resolvedObservationCount: 0,
          unresolvedObservationCount: 0,
          occurrenceAssignmentCount: 0,
        })
        .returning({ id: courseProjectionRuns.id, projectedAt: courseProjectionRuns.projectedAt });
      const projectionRun = insertedRuns[0];
      if (projectionRun === undefined) {
        return yield* Effect.die("PostgreSQL did not return the course projection run");
      }
      if (sourceRuns.length > 0) {
        yield* transaction
          .insert(courseProjectionRunSources)
          .values(
            sourceRuns.map((run) => ({ projectionRunId: projectionRun.id, sourceRunId: run.id })),
          );
      }

      const startPlans = resolution.assignments.filter((item) => item._tag === "Start");
      const crypto = yield* Crypto.Crypto;
      const allocated = yield* Effect.forEach(startPlans, (plan) =>
        crypto.randomUUIDv4.pipe(
          Effect.orDie,
          Effect.map((id) => ({ plan, id })),
        ),
      );
      if (allocated.length > 0) {
        yield* transaction.insert(courseOfferings).values(
          allocated.map((item) => ({
            id: item.id,
            dataSourceId,
            schoolId: profile.schoolId,
            createdInRunId: projectionRun.id,
          })),
        );
      }
      const offeringByObservationId = new Map<string, string>();
      const resolutionReasonByObservationId = new Map<string, string>();
      const previousResolutionReasonByObservationId = new Map(
        currentAnnualRows.map((row) => [row.observationId, row.resolutionReason]),
      );
      for (const plan of resolution.assignments) {
        if (plan._tag === "Reuse") {
          offeringByObservationId.set(plan.annualObservationId, plan.courseOfferingId);
          resolutionReasonByObservationId.set(
            plan.annualObservationId,
            previousResolutionReasonByObservationId.get(plan.annualObservationId) ??
              "UniqueSameComponent",
          );
        } else if (plan._tag === "Unresolved") {
          resolutionReasonByObservationId.set(plan.annualObservationId, plan.reason);
        }
      }
      for (const item of allocated) {
        for (const observationId of item.plan.annualObservationIds) {
          offeringByObservationId.set(observationId, item.id);
          resolutionReasonByObservationId.set(observationId, "MatureUniquePattern");
        }
      }

      let changedCount = allocated.length;
      const existingAnnualById = new Map(currentAnnualRows.map((row) => [row.observationId, row]));
      const activeAnnualIds = new Set(annual.map((item) => item.id));
      const removedAnnual = currentAnnualRows.filter(
        (row) => row.active && !activeAnnualIds.has(row.observationId),
      );
      if (removedAnnual.length > 0) {
        changedCount += removedAnnual.length;
        yield* transaction
          .update(courseAnnualObservations)
          .set({ active: false, lastProjectedInRunId: projectionRun.id, updatedAt: sql`now()` })
          .where(
            inArray(
              courseAnnualObservations.key,
              removedAnnual.map((row) => row.key),
            ),
          );
      }

      for (const observation of annual) {
        const payload = yield* encodeAnnualObservation(observation);
        const contentHash = yield* sha256Json(payload);
        const existing = existingAnnualById.get(observation.id);
        const courseOfferingId = offeringByObservationId.get(observation.id) ?? null;
        const resolutionReason = resolutionReasonByObservationId.get(observation.id) ?? null;
        const changed =
          existing === undefined ||
          existing.contentHash !== contentHash ||
          !existing.active ||
          existing.courseOfferingId !== courseOfferingId ||
          existing.resolutionReason !== resolutionReason;
        if (!changed) continue;
        changedCount += 1;
        yield* transaction
          .insert(courseAnnualObservations)
          .values({
            key: annualKey(dataSourceId, observation.id),
            dataSourceId,
            observationId: observation.id,
            academicYearExternalId: observation.academicYearExternalId,
            contentHash,
            payload,
            active: true,
            courseOfferingId,
            resolutionReason,
            firstProjectedInRunId: projectionRun.id,
            lastProjectedInRunId: projectionRun.id,
            resolvedInRunId: courseOfferingId === null ? null : projectionRun.id,
          })
          .onConflictDoUpdate({
            target: courseAnnualObservations.key,
            set: {
              academicYearExternalId: observation.academicYearExternalId,
              contentHash,
              payload,
              active: true,
              courseOfferingId,
              resolutionReason,
              lastProjectedInRunId: projectionRun.id,
              resolvedInRunId:
                courseOfferingId === null
                  ? (existing?.resolvedInRunId ?? null)
                  : existing?.courseOfferingId === courseOfferingId
                    ? existing.resolvedInRunId
                    : projectionRun.id,
              updatedAt: sql`now()`,
            },
          });
      }

      const existingAnnualSourceRows =
        currentAnnualRows.length === 0
          ? []
          : yield* transaction
              .select()
              .from(courseAnnualObservationSources)
              .where(
                inArray(
                  courseAnnualObservationSources.annualObservationKey,
                  currentAnnualRows.map((row) => row.key),
                ),
              );
      const existingSourcesByKey = new Map<string, Array<string>>();
      for (const row of existingAnnualSourceRows) {
        const sources = existingSourcesByKey.get(row.annualObservationKey) ?? [];
        sources.push(row.sourceRecordVersionId);
        existingSourcesByKey.set(row.annualObservationKey, sources);
      }
      for (const observation of annual) {
        const key = annualKey(dataSourceId, observation.id);
        const sourceVersionIds = [
          ...new Set(
            observation.datedObservationIds.flatMap((id) => {
              const roster = datedById.get(id);
              if (roster === undefined) return [];
              const ordinary = occurrenceByRosterKey.get(
                courseRosterOccurrenceKey(roster.date, roster.providerEntryIds),
              );
              return [
                ...roster.sourceExternalIds.flatMap(
                  (externalId) => rosterSourceVersion.get(externalId) ?? [],
                ),
                ...(ordinary === undefined ? [] : (occurrenceSources.get(ordinary.id) ?? [])),
              ];
            }),
          ),
        ].sort(Order.String);
        const existing = (existingSourcesByKey.get(key) ?? []).sort(Order.String);
        if (sameStrings(sourceVersionIds, existing)) continue;
        changedCount += 1;
        yield* transaction
          .delete(courseAnnualObservationSources)
          .where(eq(courseAnnualObservationSources.annualObservationKey, key));
        if (sourceVersionIds.length > 0) {
          yield* transaction.insert(courseAnnualObservationSources).values(
            sourceVersionIds.map((sourceRecordVersionId) => ({
              annualObservationKey: key,
              sourceRecordVersionId,
            })),
          );
        }
      }

      const currentDecisionRows = yield* transaction
        .select()
        .from(courseIdentityDecisions)
        .where(eq(courseIdentityDecisions.dataSourceId, dataSourceId));
      const currentDecisionByKey = new Map(currentDecisionRows.map((row) => [row.key, row]));
      const activeDecisionKeys = new Set(
        retainedDecisions.map((decision) =>
          decisionKey(dataSourceId, decision.leftObservationId, decision.rightObservationId),
        ),
      );
      const removedDecisions = currentDecisionRows.filter(
        (row) => row.active && !activeDecisionKeys.has(row.key),
      );
      if (removedDecisions.length > 0) {
        changedCount += removedDecisions.length;
        yield* transaction
          .update(courseIdentityDecisions)
          .set({ active: false, lastEvaluatedInRunId: projectionRun.id, updatedAt: sql`now()` })
          .where(
            inArray(
              courseIdentityDecisions.key,
              removedDecisions.map((row) => row.key),
            ),
          );
      }
      for (const decision of retainedDecisions) {
        const key = decisionKey(
          dataSourceId,
          decision.leftObservationId,
          decision.rightObservationId,
        );
        const payload = yield* encodeDecision(decision);
        const contentHash = yield* sha256Json(payload);
        const existing = currentDecisionByKey.get(key);
        if (existing?.active && existing.contentHash === contentHash) continue;
        changedCount += 1;
        yield* transaction
          .insert(courseIdentityDecisions)
          .values({
            key,
            dataSourceId,
            leftObservationKey: annualKey(dataSourceId, decision.leftObservationId),
            rightObservationKey: annualKey(dataSourceId, decision.rightObservationId),
            ruleId: decision.ruleId,
            outcome: decision._tag,
            contentHash,
            payload,
            active: true,
            firstEvaluatedInRunId: projectionRun.id,
            lastEvaluatedInRunId: projectionRun.id,
          })
          .onConflictDoUpdate({
            target: courseIdentityDecisions.key,
            set: {
              ruleId: decision.ruleId,
              outcome: decision._tag,
              contentHash,
              payload,
              active: true,
              lastEvaluatedInRunId: projectionRun.id,
              updatedAt: sql`now()`,
            },
          });
      }

      const directoryEntityRows = yield* transaction
        .select({ key: directoryEntities.key, payload: directoryEntities.payload })
        .from(directoryEntities)
        .where(
          and(
            eq(directoryEntities.dataSourceId, dataSourceId),
            inArray(directoryEntities.entityKind, ["AcademicYear", "Cohort", "ClassGroup"]),
          ),
        );
      const canonicalDirectory = yield* Effect.forEach(directoryEntityRows, decodeDirectoryEntity);
      const existingClassGroupIds = new Set(
        canonicalDirectory.flatMap((entity) =>
          entity._tag === "ClassGroup" ? [entity.value.id] : [],
        ),
      );
      const cohortIdByEntryYear = new Map(
        canonicalDirectory.flatMap((entity) =>
          entity._tag === "Cohort"
            ? [[entity.value.entryAcademicYearStart, entity.value.id] as const]
            : [],
        ),
      );
      const existingAcademicYearIds = new Set(
        canonicalDirectory.flatMap((entity) =>
          entity._tag === "AcademicYear" ? [entity.value.id] : [],
        ),
      );
      const representationByKey = new Map<
        string,
        {
          readonly courseOfferingId: string;
          readonly academicYearId: string;
          readonly observations: Array<AnnualCourseObservation>;
        }
      >();
      for (const observation of annual) {
        const courseOfferingId = offeringByObservationId.get(observation.id);
        const academicYear = academicYearByExternalId.get(observation.academicYearExternalId);
        if (courseOfferingId === undefined || academicYear === undefined) continue;
        const academicYearId = Organization.AcademicYearId.make(
          profile.entityId("academic-year", academicYear.externalId),
        );
        if (!existingAcademicYearIds.has(academicYearId)) continue;
        const key = JSON.stringify([courseOfferingId, academicYearId]);
        const representation = representationByKey.get(key) ?? {
          courseOfferingId,
          academicYearId,
          observations: [],
        };
        representation.observations.push(observation);
        representationByKey.set(key, representation);
      }
      for (const representation of representationByKey.values()) {
        const courseOfferingId = Organization.CourseOfferingId.make(
          representation.courseOfferingId,
        );
        const classGroupIds = [
          ...new Set(
            representation.observations.flatMap((observation) =>
              observation.rosterPartitions.flatMap((partition) => {
                if (!partition.schoolGroupKey.startsWith("ClassGroup:")) return [];
                const id = Organization.ClassGroupId.make(
                  partition.schoolGroupKey.slice("ClassGroup:".length),
                );
                return existingClassGroupIds.has(id) ? [Organization.ClassGroupId.make(id)] : [];
              }),
            ),
          ),
        ].sort(Order.String);
        const cohortIds = [
          ...new Set(
            representation.observations.flatMap((observation) =>
              observation.rosterPartitions.flatMap((partition) => {
                if (!partition.schoolGroupKey.startsWith("CohortEntry:")) return [];
                const id = cohortIdByEntryYear.get(
                  Number(partition.schoolGroupKey.slice("CohortEntry:".length)),
                );
                return id === undefined ? [] : [id];
              }),
            ),
          ),
        ].sort(Order.String);
        const name = [...new Set(representation.observations.flatMap((item) => item.courseCodes))]
          .sort(Order.String)
          .join(" / ");
        const courseName = yield* Schema.decodeEffect(NonBlankText)(name).pipe(
          Effect.mapError(invalidProjection(representation.courseOfferingId)),
        );
        const value = Organization.CourseOfferingAcademicYear.make({
          courseOfferingId,
          academicYearId: Organization.AcademicYearId.make(representation.academicYearId),
          name: courseName,
          cohortIds,
          classGroupIds,
        });
        const payload = yield* encodeAcademicYearRepresentation(value);
        const contentHash = yield* sha256Json(payload);
        const current = yield* transaction
          .select({ contentHash: courseOfferingAcademicYears.contentHash })
          .from(courseOfferingAcademicYears)
          .where(
            and(
              eq(courseOfferingAcademicYears.courseOfferingId, representation.courseOfferingId),
              eq(courseOfferingAcademicYears.academicYearId, representation.academicYearId),
            ),
          )
          .limit(1);
        if (current[0]?.contentHash === contentHash) continue;
        changedCount += 1;
        yield* transaction
          .insert(courseOfferingAcademicYears)
          .values({
            courseOfferingId: representation.courseOfferingId,
            academicYearId: representation.academicYearId,
            contentHash,
            payload,
            updatedInRunId: projectionRun.id,
          })
          .onConflictDoUpdate({
            target: [
              courseOfferingAcademicYears.courseOfferingId,
              courseOfferingAcademicYears.academicYearId,
            ],
            set: { contentHash, payload, updatedInRunId: projectionRun.id, updatedAt: sql`now()` },
          });
      }

      const currentCourseLinkRows = yield* transaction
        .select({ externalId: entityLinks.externalId, domainEntityId: entityLinks.domainEntityId })
        .from(entityLinks)
        .where(
          and(
            eq(entityLinks.dataSourceId, dataSourceId),
            eq(entityLinks.entityKind, "CourseOffering"),
            eq(entityLinks.domainEntityKind, "CourseOffering"),
          ),
        );
      const currentCourseLinkByObservationId = new Map(
        currentCourseLinkRows.map((row) => [row.externalId, row.domainEntityId]),
      );
      for (const [observationId, courseOfferingId] of offeringByObservationId) {
        if (currentCourseLinkByObservationId.get(observationId) === courseOfferingId) continue;
        changedCount += 1;
        yield* transaction
          .insert(entityLinks)
          .values({
            dataSourceId,
            entityKind: "CourseOffering",
            externalId: observationId,
            domainEntityKind: "CourseOffering",
            domainEntityId: courseOfferingId,
          })
          .onConflictDoUpdate({
            target: [
              entityLinks.dataSourceId,
              entityLinks.entityKind,
              entityLinks.externalId,
              entityLinks.domainEntityKind,
            ],
            set: { domainEntityId: courseOfferingId, updatedAt: sql`now()` },
          });
      }

      const desiredOccurrenceAssignments = new Map<
        string,
        {
          readonly occurrenceId: string;
          readonly courseOfferingId: string;
          readonly annualObservationKey: string;
        }
      >();
      for (const observation of annual) {
        const courseOfferingId = offeringByObservationId.get(observation.id);
        if (courseOfferingId === undefined) continue;
        for (const datedObservationId of observation.datedObservationIds) {
          const roster = datedById.get(datedObservationId);
          if (roster === undefined) continue;
          const occurrence = occurrenceByRosterKey.get(
            courseRosterOccurrenceKey(roster.date, roster.providerEntryIds),
          );
          const [firstProviderEntryId, ...otherProviderEntryIds] = roster.providerEntryIds;
          const occurrenceId =
            occurrence?.id ??
            Schedule.providerBackedOccurrenceId({
              dataSourceId,
              date: PlainDate.fromString(roster.date, Calendar.getBasic),
              providerEntryIds: [
                Importing.ExternalId.make(firstProviderEntryId),
                ...otherProviderEntryIds.map((id) => Importing.ExternalId.make(id)),
              ],
            });
          const key = JSON.stringify([occurrenceId, courseOfferingId]);
          const candidate = {
            occurrenceId,
            courseOfferingId,
            annualObservationKey: annualKey(dataSourceId, observation.id),
          };
          const current = desiredOccurrenceAssignments.get(key);
          if (
            current === undefined ||
            Order.String(candidate.annualObservationKey, current.annualObservationKey) < 0
          ) {
            desiredOccurrenceAssignments.set(key, candidate);
          }
        }
      }
      const currentOccurrenceAssignments = yield* transaction
        .select()
        .from(courseOccurrenceAssignments)
        .where(eq(courseOccurrenceAssignments.dataSourceId, dataSourceId));
      const currentOccurrenceByKey = new Map(
        currentOccurrenceAssignments.map((item) => [
          JSON.stringify([item.occurrenceId, item.courseOfferingId]),
          item,
        ]),
      );
      const occurrenceAssignmentsChanged =
        currentOccurrenceAssignments.length !== desiredOccurrenceAssignments.size ||
        [...desiredOccurrenceAssignments].some(
          ([key, desired]) =>
            currentOccurrenceByKey.get(key)?.annualObservationKey !== desired.annualObservationKey,
        );
      if (occurrenceAssignmentsChanged) {
        changedCount += 1;
        yield* transaction
          .delete(courseOccurrenceAssignments)
          .where(eq(courseOccurrenceAssignments.dataSourceId, dataSourceId));
        if (desiredOccurrenceAssignments.size > 0) {
          yield* transaction.insert(courseOccurrenceAssignments).values(
            [...desiredOccurrenceAssignments.values()].map((item) => ({
              dataSourceId,
              ...item,
              assignedInRunId: projectionRun.id,
            })),
          );
        }
      }

      const desiredCourseIdsByOccurrence = new Map<string, Array<string>>();
      for (const item of desiredOccurrenceAssignments.values()) {
        const ids = desiredCourseIdsByOccurrence.get(item.occurrenceId) ?? [];
        ids.push(item.courseOfferingId);
        desiredCourseIdsByOccurrence.set(item.occurrenceId, ids);
      }
      for (const row of occurrenceRows) {
        const occurrence = yield* decodeOccurrence(row);
        const desiredCourseIds = [...new Set(desiredCourseIdsByOccurrence.get(row.id) ?? [])].sort(
          Order.String,
        );
        if (sameStrings(occurrence.courseOfferingIds, desiredCourseIds)) continue;
        const updated = Schedule.ProviderBackedOccurrence.make({
          id: occurrence.id,
          dataSourceId: occurrence.dataSourceId,
          date: occurrence.date,
          providerEntryIds: occurrence.providerEntryIds,
          recurringMeetingId: occurrence.recurringMeetingId,
          courseOfferingIds: desiredCourseIds.map((id) => Organization.CourseOfferingId.make(id)),
          bellPeriodId: occurrence.bellPeriodId,
          claims: occurrence.claims,
        });
        const payload = yield* encodeOccurrence(updated);
        const contentHash = yield* sha256Json(payload);
        yield* transaction
          .update(timetableOccurrences)
          .set({ payload, contentHash, updatedAt: sql`now()` })
          .where(eq(timetableOccurrences.id, row.id));
        changedCount += 1;
      }

      const resolvedObservationCount = offeringByObservationId.size;
      const unresolvedObservationCount = annual.length - resolvedObservationCount;
      yield* transaction
        .update(courseProjectionRuns)
        .set({
          outcome: changedCount === 0 ? "Unchanged" : "Changed",
          resolvedObservationCount,
          unresolvedObservationCount,
          createdOfferingCount: allocated.length,
          occurrenceAssignmentCount: desiredOccurrenceAssignments.size,
          changedCount,
        })
        .where(eq(courseProjectionRuns.id, projectionRun.id));

      return {
        _tag: changedCount === 0 ? "Unchanged" : "Projected",
        runId: projectionRun.id,
        dataSourceId,
        annualObservationCount: annual.length,
        decisionCount: resolution.decisions.length,
        resolvedObservationCount,
        unresolvedObservationCount,
        createdOfferingCount: allocated.length,
        occurrenceAssignmentCount: desiredOccurrenceAssignments.size,
        changedCount,
        projectedAt: projectionRun.projectedAt,
      } as const;
    }),
  );
});

/** Reads canonical offerings plus private reconciliation evidence for server-side administration. */
export const readCurrent = Effect.fn("Organization.readCurrentCourses")(function* (input: {
  readonly dataSourceId: string;
}) {
  const database = yield* Database.Service;
  const dataSourceId = yield* Schema.decodeEffect(Importing.DataSourceId)(input.dataSourceId);
  const [offeringRows, representationRows, observationRows, decisionRows] = yield* Effect.all([
    database.drizzle
      .select()
      .from(courseOfferings)
      .where(eq(courseOfferings.dataSourceId, dataSourceId)),
    database.drizzle
      .select({ payload: courseOfferingAcademicYears.payload })
      .from(courseOfferingAcademicYears)
      .innerJoin(
        courseOfferings,
        eq(courseOfferings.id, courseOfferingAcademicYears.courseOfferingId),
      )
      .where(eq(courseOfferings.dataSourceId, dataSourceId)),
    database.drizzle
      .select({ key: courseAnnualObservations.key, payload: courseAnnualObservations.payload })
      .from(courseAnnualObservations)
      .where(
        and(
          eq(courseAnnualObservations.dataSourceId, dataSourceId),
          eq(courseAnnualObservations.active, true),
        ),
      ),
    database.drizzle
      .select({ key: courseIdentityDecisions.key, payload: courseIdentityDecisions.payload })
      .from(courseIdentityDecisions)
      .where(
        and(
          eq(courseIdentityDecisions.dataSourceId, dataSourceId),
          eq(courseIdentityDecisions.active, true),
        ),
      ),
  ]);
  const offerings = offeringRows.map((row) =>
    Organization.CourseOffering.make({
      id: Organization.CourseOfferingId.make(row.id),
      schoolId: Organization.SchoolId.make(row.schoolId),
    }),
  );
  const academicYears = yield* Effect.forEach(representationRows, (row) =>
    Schema.decodeUnknownEffect(Organization.CourseOfferingAcademicYear)(row.payload).pipe(
      Effect.mapError((error) =>
        InvalidCourseProjectionRecord.make({ recordId: "academic-year", reason: String(error) }),
      ),
    ),
  );
  const observations = yield* Effect.forEach(observationRows, (row) =>
    Schema.decodeUnknownEffect(AnnualCourseObservation)(row.payload).pipe(
      Effect.mapError((error) =>
        InvalidCourseProjectionRecord.make({ recordId: row.key, reason: String(error) }),
      ),
    ),
  );
  const decisions = yield* Effect.forEach(decisionRows, (row) =>
    Schema.decodeUnknownEffect(CourseIdentityDecision)(row.payload).pipe(
      Effect.mapError((error) =>
        InvalidCourseProjectionRecord.make({ recordId: row.key, reason: String(error) }),
      ),
    ),
  );
  return { offerings, academicYears, observations, decisions } as const;
});

export * as CourseProjectionStore from "./course-projection-store.ts";
