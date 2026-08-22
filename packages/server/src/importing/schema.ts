import type { ExternalEntityKind } from "@stu/core/importing";
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

/** One immutable, complete provider snapshot. Older runs remain available for rollback and audit. */
export const sourceImportRuns = pgTable(
  "source_import_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    dataSourceId: text("dataSourceId").notNull(),
    dataset: text("dataset").notNull(),
    scope: text("scope").notNull(),
    contentHash: text("contentHash").notNull(),
    completeness: text("completeness").$type<"Complete">().default("Complete").notNull(),
    observationCount: integer("observationCount").notNull(),
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

/** One provider-owned record as it appeared in an import generation. */
export const sourceObservations = pgTable(
  "source_observations",
  {
    runId: uuid("runId")
      .notNull()
      .references(() => sourceImportRuns.id, { onDelete: "cascade" }),
    entityKind: text("entityKind").$type<ExternalEntityKind>().notNull(),
    externalId: text("externalId").notNull(),
    contentHash: text("contentHash").notNull(),
    payload: jsonb("payload").$type<Schema.Json>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.entityKind, table.externalId] }),
    index("source_observations_identity_idx").on(table.entityKind, table.externalId),
  ],
);
