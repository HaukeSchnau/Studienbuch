import type { EntityLink, ExternalEntityKind } from "@stu/core/importing";
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

/** One successful provider poll. The current run is the latest state transition for its scope. */
export const sourceImportRuns = pgTable(
  "source_import_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    dataSourceId: text("dataSourceId").notNull(),
    dataset: text("dataset").notNull(),
    scope: text("scope").notNull(),
    contentHash: text("contentHash").notNull(),
    completeness: text("completeness").$type<"Complete" | "Partial">().notNull(),
    outcome: text("outcome").$type<"Changed" | "Unchanged" | "Migrated">().notNull(),
    observationCount: integer("observationCount").notNull(),
    addedCount: integer("addedCount").default(0).notNull(),
    updatedCount: integer("updatedCount").default(0).notNull(),
    removedCount: integer("removedCount").default(0).notNull(),
    reactivatedCount: integer("reactivatedCount").default(0).notNull(),
    counts: jsonb("counts").$type<Schema.Json>().notNull(),
    diagnostics: jsonb("diagnostics").$type<Schema.Json>().notNull(),
    isCurrent: boolean("isCurrent").default(false).notNull(),
    observedAt: timestamp("observedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("source_import_runs_scope_idx").on(table.dataSourceId, table.dataset, table.scope),
    uniqueIndex("source_import_runs_current_unique")
      .on(table.dataSourceId, table.dataset, table.scope)
      .where(sql`${table.isCurrent} = true`),
  ],
);

/** One immutable payload for a provider identity. Equal payload hashes share one version. */
export const sourceRecordVersions = pgTable(
  "source_record_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataSourceId: text("dataSourceId").notNull(),
    dataset: text("dataset").notNull(),
    scope: text("scope").notNull(),
    entityKind: text("entityKind").$type<ExternalEntityKind>().notNull(),
    externalId: text("externalId").notNull(),
    contentHash: text("contentHash").notNull(),
    payload: jsonb("payload").$type<Schema.Json>().notNull(),
    firstObservedInRunId: uuid("firstObservedInRunId")
      .notNull()
      .references(() => sourceImportRuns.id),
    observedAt: timestamp("observedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("source_record_versions_identity_hash_unique").on(
      table.dataSourceId,
      table.dataset,
      table.scope,
      table.entityKind,
      table.externalId,
      table.contentHash,
    ),
    index("source_record_versions_identity_idx").on(
      table.dataSourceId,
      table.dataset,
      table.scope,
      table.entityKind,
      table.externalId,
    ),
  ],
);

/** Current state of one provider identity within one independently reconciled scope. */
export const sourceRecords = pgTable(
  "source_records",
  {
    dataSourceId: text("dataSourceId").notNull(),
    dataset: text("dataset").notNull(),
    scope: text("scope").notNull(),
    entityKind: text("entityKind").$type<ExternalEntityKind>().notNull(),
    externalId: text("externalId").notNull(),
    currentVersionId: uuid("currentVersionId")
      .notNull()
      .references(() => sourceRecordVersions.id),
    active: boolean("active").notNull(),
    firstSeenInRunId: uuid("firstSeenInRunId")
      .notNull()
      .references(() => sourceImportRuns.id),
    lastChangedInRunId: uuid("lastChangedInRunId")
      .notNull()
      .references(() => sourceImportRuns.id),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.dataSourceId, table.dataset, table.scope, table.entityKind, table.externalId],
    }),
    index("source_records_current_version_idx").on(table.currentVersionId),
  ],
);

export type SourceChangeType = "Added" | "Updated" | "Removed" | "Reactivated";

/** A record-level transition emitted by one successful import run. */
export const sourceChanges = pgTable(
  "source_changes",
  {
    runId: uuid("runId")
      .notNull()
      .references(() => sourceImportRuns.id, { onDelete: "cascade" }),
    entityKind: text("entityKind").$type<ExternalEntityKind>().notNull(),
    externalId: text("externalId").notNull(),
    changeType: text("changeType").$type<SourceChangeType>().notNull(),
    beforeVersionId: uuid("beforeVersionId").references(() => sourceRecordVersions.id),
    afterVersionId: uuid("afterVersionId").references(() => sourceRecordVersions.id),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.entityKind, table.externalId] }),
    index("source_changes_after_version_idx").on(table.afterVersionId),
  ],
);

/** Durable correspondence between a provider identity and a stable Studienbuch entity. */
export const entityLinks = pgTable(
  "entity_links",
  {
    dataSourceId: text("dataSourceId").notNull(),
    entityKind: text("entityKind").$type<ExternalEntityKind>().notNull(),
    externalId: text("externalId").notNull(),
    domainEntityKind: text("domainEntityKind").$type<EntityLink["_tag"]>().notNull(),
    domainEntityId: text("domainEntityId").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.dataSourceId, table.entityKind, table.externalId, table.domainEntityKind],
    }),
    index("entity_links_domain_idx").on(table.domainEntityKind, table.domainEntityId),
  ],
);
