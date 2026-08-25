import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type * as Schema from "effect/Schema";
import { sourceImportRuns, sourceRecordVersions } from "../importing/schema.ts";
import type {
  AnnualCourseObservation,
  CourseIdentityDecision,
} from "../webuntis/course-reconciliation.ts";

/** One atomic replay of all current private course-roster evidence for a data source. */
export const courseProjectionRuns = pgTable(
  "course_projection_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    ruleId: text("ruleId").notNull(),
    outcome: text("outcome").$type<"Changed" | "Unchanged">().notNull(),
    annualObservationCount: integer("annualObservationCount").notNull(),
    decisionCount: integer("decisionCount").notNull(),
    resolvedObservationCount: integer("resolvedObservationCount").notNull(),
    unresolvedObservationCount: integer("unresolvedObservationCount").notNull(),
    createdOfferingCount: integer("createdOfferingCount").default(0).notNull(),
    occurrenceAssignmentCount: integer("occurrenceAssignmentCount").notNull(),
    changedCount: integer("changedCount").default(0).notNull(),
    projectedAt: timestamp("projectedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("course_projection_runs_source_idx").on(table.dataSourceId)],
);

/** Current source runs whose records were read by a course projection replay. */
export const courseProjectionRunSources = pgTable(
  "course_projection_run_sources",
  {
    projectionRunId: uuid("projectionRunId")
      .notNull()
      .references(() => courseProjectionRuns.id, { onDelete: "cascade" }),
    sourceRunId: uuid("sourceRunId")
      .notNull()
      .references(() => sourceImportRuns.id),
  },
  (table) => [primaryKey({ columns: [table.projectionRunId, table.sourceRunId] })],
);

/** Permanent opaque identity. Provider observations only point at it after reconciliation. */
export const courseOfferings = pgTable(
  "course_offerings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    schoolId: text("schoolId").notNull(),
    createdInRunId: uuid("createdInRunId")
      .notNull()
      .references(() => courseProjectionRuns.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("course_offerings_school_idx").on(table.schoolId)],
);

/** Private annual provider pattern and its optional stable identity resolution. */
export const courseAnnualObservations = pgTable(
  "course_annual_observations",
  {
    key: text("key").primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    observationId: text("observationId").notNull(),
    academicYearExternalId: text("academicYearExternalId").notNull(),
    contentHash: text("contentHash").notNull(),
    payload: jsonb("payload").$type<Schema.Json | AnnualCourseObservation>().notNull(),
    active: boolean("active").default(true).notNull(),
    courseOfferingId: uuid("courseOfferingId").references(() => courseOfferings.id),
    resolutionReason: text("resolutionReason"),
    firstProjectedInRunId: uuid("firstProjectedInRunId")
      .notNull()
      .references(() => courseProjectionRuns.id),
    lastProjectedInRunId: uuid("lastProjectedInRunId")
      .notNull()
      .references(() => courseProjectionRuns.id),
    resolvedInRunId: uuid("resolvedInRunId").references(() => courseProjectionRuns.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_annual_observations_identity_unique").on(
      table.dataSourceId,
      table.observationId,
    ),
    index("course_annual_observations_year_idx").on(
      table.dataSourceId,
      table.academicYearExternalId,
      table.active,
    ),
    index("course_annual_observations_offering_idx").on(table.courseOfferingId),
  ],
);

/** Exact immutable raw records that support an annual observation. */
export const courseAnnualObservationSources = pgTable(
  "course_annual_observation_sources",
  {
    annualObservationKey: text("annualObservationKey")
      .notNull()
      .references(() => courseAnnualObservations.key, { onDelete: "cascade" }),
    sourceRecordVersionId: uuid("sourceRecordVersionId")
      .notNull()
      .references(() => sourceRecordVersions.id),
  },
  (table) => [primaryKey({ columns: [table.annualObservationKey, table.sourceRecordVersionId] })],
);

/** Latest deterministic pair classification, including the evidence behind the result. */
export const courseIdentityDecisions = pgTable(
  "course_identity_decisions",
  {
    key: text("key").primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    leftObservationKey: text("leftObservationKey")
      .notNull()
      .references(() => courseAnnualObservations.key),
    rightObservationKey: text("rightObservationKey")
      .notNull()
      .references(() => courseAnnualObservations.key),
    ruleId: text("ruleId").notNull(),
    outcome: text("outcome").$type<CourseIdentityDecision["_tag"]>().notNull(),
    contentHash: text("contentHash").notNull(),
    payload: jsonb("payload").$type<Schema.Json | CourseIdentityDecision>().notNull(),
    active: boolean("active").default(true).notNull(),
    firstEvaluatedInRunId: uuid("firstEvaluatedInRunId")
      .notNull()
      .references(() => courseProjectionRuns.id),
    lastEvaluatedInRunId: uuid("lastEvaluatedInRunId")
      .notNull()
      .references(() => courseProjectionRuns.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("course_identity_decisions_pair_unique").on(
      table.dataSourceId,
      table.leftObservationKey,
      table.rightObservationKey,
    ),
    index("course_identity_decisions_outcome_idx").on(table.dataSourceId, table.outcome),
  ],
);

/** Canonical school-year representation of a stable offering. */
export const courseOfferingAcademicYears = pgTable(
  "course_offering_academic_years",
  {
    courseOfferingId: uuid("courseOfferingId")
      .notNull()
      .references(() => courseOfferings.id),
    academicYearId: text("academicYearId").notNull(),
    contentHash: text("contentHash").notNull(),
    payload: jsonb("payload").$type<Schema.Json>().notNull(),
    updatedInRunId: uuid("updatedInRunId")
      .notNull()
      .references(() => courseProjectionRuns.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.courseOfferingId, table.academicYearId] })],
);

/** Durable overlay reapplied whenever the underlying timetable scope is projected again. */
export const courseOccurrenceAssignments = pgTable(
  "course_occurrence_assignments",
  {
    dataSourceId: text("dataSourceId").notNull(),
    occurrenceId: text("occurrenceId").notNull(),
    courseOfferingId: uuid("courseOfferingId")
      .notNull()
      .references(() => courseOfferings.id),
    annualObservationKey: text("annualObservationKey")
      .notNull()
      .references(() => courseAnnualObservations.key),
    assignedInRunId: uuid("assignedInRunId")
      .notNull()
      .references(() => courseProjectionRuns.id),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.dataSourceId, table.occurrenceId, table.courseOfferingId] }),
    index("course_occurrence_assignments_occurrence_idx").on(
      table.dataSourceId,
      table.occurrenceId,
    ),
    uniqueIndex("course_occurrence_assignments_evidence_unique")
      .on(table.dataSourceId, table.occurrenceId, table.annualObservationKey)
      .where(sql`${table.annualObservationKey} is not null`),
  ],
);
