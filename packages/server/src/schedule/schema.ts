import {
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

/** One deterministic replay of the current timetable source records in a daily scope. */
export const timetableProjectionRuns = pgTable(
  "timetable_projection_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    scope: text("scope").notNull(),
    sourceRunId: uuid("sourceRunId")
      .notNull()
      .references(() => sourceImportRuns.id),
    outcome: text("outcome").$type<"Changed" | "Unchanged">().notNull(),
    occurrenceCount: integer("occurrenceCount").notNull(),
    addedCount: integer("addedCount").default(0).notNull(),
    updatedCount: integer("updatedCount").default(0).notNull(),
    removedCount: integer("removedCount").default(0).notNull(),
    relinkedCount: integer("relinkedCount").default(0).notNull(),
    projectedAt: timestamp("projectedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("timetable_projection_runs_scope_idx").on(table.dataSourceId, table.scope),
    index("timetable_projection_runs_source_run_idx").on(table.sourceRunId),
  ],
);

/** Current server-side domain occurrence. The encoded payload is validated at every read/write. */
export const timetableOccurrences = pgTable(
  "timetable_occurrences",
  {
    id: text("id").primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    scope: text("scope").notNull(),
    date: text("date").notNull(),
    contentHash: text("contentHash").notNull(),
    payload: jsonb("payload").$type<Schema.Json>().notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("timetable_occurrences_source_date_idx").on(table.dataSourceId, table.date),
    uniqueIndex("timetable_occurrences_scope_id_unique").on(
      table.dataSourceId,
      table.scope,
      table.id,
    ),
  ],
);

/** Exact immutable source versions that contributed claims to the current occurrence. */
export const timetableOccurrenceSources = pgTable(
  "timetable_occurrence_sources",
  {
    occurrenceId: text("occurrenceId")
      .notNull()
      .references(() => timetableOccurrences.id, { onDelete: "cascade" }),
    sourceRecordVersionId: uuid("sourceRecordVersionId")
      .notNull()
      .references(() => sourceRecordVersions.id),
  },
  (table) => [primaryKey({ columns: [table.occurrenceId, table.sourceRecordVersionId] })],
);

/** A projection transition. This is server audit data, not an authorized client sync event. */
export const timetableProjectionChanges = pgTable(
  "timetable_projection_changes",
  {
    projectionRunId: uuid("projectionRunId")
      .notNull()
      .references(() => timetableProjectionRuns.id, { onDelete: "cascade" }),
    occurrenceId: text("occurrenceId").notNull(),
    changeType: text("changeType").$type<"Added" | "Updated" | "Removed" | "Relinked">().notNull(),
    beforeContentHash: text("beforeContentHash"),
    afterContentHash: text("afterContentHash"),
  },
  (table) => [
    primaryKey({ columns: [table.projectionRunId, table.occurrenceId] }),
    index("timetable_projection_changes_occurrence_idx").on(table.occurrenceId),
  ],
);
