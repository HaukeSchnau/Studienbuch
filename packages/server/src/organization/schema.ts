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
import type { DirectoryEntity } from "./directory-entity.ts";

/** One replay of every current directory scope for a provider-backed school. */
export const directoryProjectionRuns = pgTable(
  "directory_projection_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    outcome: text("outcome").$type<"Changed" | "Unchanged">().notNull(),
    entityCount: integer("entityCount").notNull(),
    addedCount: integer("addedCount").default(0).notNull(),
    updatedCount: integer("updatedCount").default(0).notNull(),
    removedCount: integer("removedCount").default(0).notNull(),
    relinkedCount: integer("relinkedCount").default(0).notNull(),
    diagnostics: jsonb("diagnostics").$type<Schema.Json>().notNull(),
    projectedAt: timestamp("projectedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("directory_projection_runs_source_idx").on(table.dataSourceId)],
);

/** Every current source scope that contributed to a directory replay. */
export const directoryProjectionRunSources = pgTable(
  "directory_projection_run_sources",
  {
    projectionRunId: uuid("projectionRunId")
      .notNull()
      .references(() => directoryProjectionRuns.id, { onDelete: "cascade" }),
    sourceRunId: uuid("sourceRunId")
      .notNull()
      .references(() => sourceImportRuns.id),
  },
  (table) => [primaryKey({ columns: [table.projectionRunId, table.sourceRunId] })],
);

/** Current canonical server-side directory entity, validated at every read and write. */
export const directoryEntities = pgTable(
  "directory_entities",
  {
    key: text("key").primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    entityKind: text("entityKind").$type<DirectoryEntity["_tag"]>().notNull(),
    entityId: text("entityId").notNull(),
    schoolId: text("schoolId").notNull(),
    contentHash: text("contentHash").notNull(),
    payload: jsonb("payload").$type<Schema.Json>().notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("directory_entities_identity_unique").on(
      table.dataSourceId,
      table.entityKind,
      table.entityId,
    ),
    index("directory_entities_school_idx").on(table.schoolId, table.entityKind),
  ],
);

/** Exact immutable provider records that support each current canonical entity. */
export const directoryEntitySources = pgTable(
  "directory_entity_sources",
  {
    entityKey: text("entityKey")
      .notNull()
      .references(() => directoryEntities.key, { onDelete: "cascade" }),
    sourceRecordVersionId: uuid("sourceRecordVersionId")
      .notNull()
      .references(() => sourceRecordVersions.id),
  },
  (table) => [primaryKey({ columns: [table.entityKey, table.sourceRecordVersionId] })],
);

/** A material directory transition. Unchanged replays only create a run. */
export const directoryProjectionChanges = pgTable(
  "directory_projection_changes",
  {
    projectionRunId: uuid("projectionRunId")
      .notNull()
      .references(() => directoryProjectionRuns.id, { onDelete: "cascade" }),
    entityKey: text("entityKey").notNull(),
    entityKind: text("entityKind").$type<DirectoryEntity["_tag"]>().notNull(),
    entityId: text("entityId").notNull(),
    changeType: text("changeType").$type<"Added" | "Updated" | "Removed" | "Relinked">().notNull(),
    beforeContentHash: text("beforeContentHash"),
    afterContentHash: text("afterContentHash"),
  },
  (table) => [
    primaryKey({ columns: [table.projectionRunId, table.entityKey] }),
    index("directory_projection_changes_entity_idx").on(table.entityKey),
  ],
);
