import { createHash } from "node:crypto";
import { Importing } from "@stu/core";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Database } from "../database/client.ts";
import { entityLinkRow } from "../importing/entity-links.ts";
import {
  entityLinks,
  sourceImportRuns,
  sourceRecords,
  sourceRecordVersions,
} from "../importing/schema.ts";
import { DirectoryObservation } from "../webuntis/directory-snapshot.ts";
import { projectDirectory, type DirectoryProjection } from "../webuntis/directory-projection.ts";
import { DirectoryEntity, directoryEntityKey } from "./directory-entity.ts";
import {
  directoryEntities,
  directoryEntitySources,
  directoryProjectionChanges,
  directoryProjectionRuns,
  directoryProjectionRunSources,
} from "./schema.ts";

export class DirectorySourceUnavailable extends Schema.TaggedError<DirectorySourceUnavailable>()(
  "Organization.DirectorySourceUnavailable",
  { dataSourceId: Schema.String },
) {}

export class InvalidDirectorySourceRecord extends Schema.TaggedError<InvalidDirectorySourceRecord>()(
  "Organization.InvalidDirectorySourceRecord",
  {
    sourceRecordVersionId: Schema.String,
    entityKind: Schema.String,
    externalId: Schema.String,
    reason: Schema.String,
  },
) {}

export class InvalidStoredDirectoryEntity extends Schema.TaggedError<InvalidStoredDirectoryEntity>()(
  "Organization.InvalidStoredDirectoryEntity",
  { entityKey: Schema.String, reason: Schema.String },
) {}

interface PreparedEntity {
  readonly key: string;
  readonly entity: DirectoryEntity;
  readonly payload: Schema.Json;
  readonly contentHash: string;
  readonly sourceRecordVersionIds: ReadonlyArray<string>;
}

interface CurrentEntity {
  readonly key: string;
  readonly entityKind: DirectoryEntity["_tag"];
  readonly entityId: string;
  readonly contentHash: string;
  readonly sourceRecordVersionIds: ReadonlyArray<string>;
}

const sameStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const hashPayload = (payload: Schema.Json) =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");

const decodeSourceRecord = (row: {
  readonly scope: string;
  readonly entityKind: string;
  readonly externalId: string;
  readonly currentVersionId: string;
  readonly payload: Schema.Json;
}) =>
  Schema.decodeUnknownEffect(DirectoryObservation)({
    _tag: row.entityKind,
    externalId: row.externalId,
    payload: row.payload,
  }).pipe(
    Effect.map((observation) => ({
      scope: row.scope,
      sourceRecordVersionId: row.currentVersionId,
      observation,
    })),
    Effect.mapError((error) =>
      InvalidDirectorySourceRecord.make({
        sourceRecordVersionId: row.currentVersionId,
        entityKind: row.entityKind,
        externalId: row.externalId,
        reason: String(error),
      }),
    ),
  );

const prepareEntities = Effect.fnUntraced(function* (projection: DirectoryProjection) {
  const sourcesByKey = new Map(
    projection.entitySources.map((source) => [source.entityKey, source.sourceRecordVersionIds]),
  );
  return yield* Effect.forEach(projection.entities, (entity) =>
    Effect.gen(function* () {
      const key = directoryEntityKey({
        dataSourceId: projection.dataSourceId,
        entityKind: entity._tag,
        entityId: entity.id,
      });
      const payload = yield* Schema.encodeEffect(DirectoryEntity)(entity);
      return {
        key,
        entity,
        payload,
        contentHash: hashPayload(payload),
        sourceRecordVersionIds: sourcesByKey.get(key) ?? [],
      } satisfies PreparedEntity;
    }),
  );
});

/** Replays all current directory scopes into one canonical provider-backed directory. */
export const projectCurrent = Effect.fn("Organization.projectCurrentDirectory")(function* (input: {
  readonly dataSourceId: string;
}) {
  const database = yield* Database.Service;
  const dataSourceId = yield* Schema.decodeEffect(Importing.DataSourceId)(input.dataSourceId);
  const lockKey = JSON.stringify([dataSourceId, "directory-projection"]);

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
            eq(sourceImportRuns.dataset, "directory"),
            eq(sourceImportRuns.isCurrent, true),
          ),
        );
      if (sourceRuns.length === 0) {
        return yield* DirectorySourceUnavailable.make({ dataSourceId });
      }

      const sourceRows = yield* transaction
        .select({
          scope: sourceRecords.scope,
          entityKind: sourceRecords.entityKind,
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
            eq(sourceRecords.dataset, "directory"),
            eq(sourceRecords.active, true),
          ),
        );
      const records = yield* Effect.forEach(sourceRows, decodeSourceRecord);
      const projection = yield* projectDirectory({ dataSourceId, records });
      const incoming = yield* prepareEntities(projection);

      const currentRows = yield* transaction
        .select({
          key: directoryEntities.key,
          entityKind: directoryEntities.entityKind,
          entityId: directoryEntities.entityId,
          contentHash: directoryEntities.contentHash,
        })
        .from(directoryEntities)
        .where(eq(directoryEntities.dataSourceId, dataSourceId));
      const currentSourceRows =
        currentRows.length === 0
          ? []
          : yield* transaction
              .select({
                entityKey: directoryEntitySources.entityKey,
                sourceRecordVersionId: directoryEntitySources.sourceRecordVersionId,
              })
              .from(directoryEntitySources)
              .where(
                inArray(
                  directoryEntitySources.entityKey,
                  currentRows.map((row) => row.key),
                ),
              );
      const currentSources = new Map<string, Array<string>>();
      for (const row of currentSourceRows) {
        const sources = currentSources.get(row.entityKey) ?? [];
        sources.push(row.sourceRecordVersionId);
        currentSources.set(row.entityKey, sources);
      }
      const current: Array<CurrentEntity> = currentRows.map((row) => ({
        ...row,
        sourceRecordVersionIds: (currentSources.get(row.key) ?? []).sort(),
      }));
      const currentByKey = new Map(current.map((item) => [item.key, item]));
      const incomingKeys = new Set(incoming.map((item) => item.key));
      const added: Array<PreparedEntity> = [];
      const updated: Array<PreparedEntity> = [];
      const relinked: Array<PreparedEntity> = [];
      for (const item of incoming) {
        const previous = currentByKey.get(item.key);
        if (previous === undefined) added.push(item);
        else if (previous.contentHash !== item.contentHash) updated.push(item);
        else if (!sameStrings(previous.sourceRecordVersionIds, item.sourceRecordVersionIds)) {
          relinked.push(item);
        }
      }
      const removed = current.filter((item) => !incomingKeys.has(item.key));
      const changedCount = added.length + updated.length + removed.length + relinked.length;
      const diagnostics: Schema.Json = projection.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        count: diagnostic.count,
      }));

      const insertedRuns = yield* transaction
        .insert(directoryProjectionRuns)
        .values({
          dataSourceId,
          outcome: changedCount === 0 ? "Unchanged" : "Changed",
          entityCount: incoming.length,
          addedCount: added.length,
          updatedCount: updated.length,
          removedCount: removed.length,
          relinkedCount: relinked.length,
          diagnostics,
        })
        .returning({
          id: directoryProjectionRuns.id,
          projectedAt: directoryProjectionRuns.projectedAt,
        });
      const projectionRun = insertedRuns[0];
      if (projectionRun === undefined) {
        return yield* Effect.die("PostgreSQL did not return the directory projection run");
      }
      yield* transaction.insert(directoryProjectionRunSources).values(
        sourceRuns.map((sourceRun) => ({
          projectionRunId: projectionRun.id,
          sourceRunId: sourceRun.id,
        })),
      );

      if (added.length > 0) {
        yield* transaction.insert(directoryEntities).values(
          added.map((item) => ({
            key: item.key,
            dataSourceId,
            entityKind: item.entity._tag,
            entityId: item.entity.id,
            schoolId: item.entity.schoolId,
            contentHash: item.contentHash,
            payload: item.payload,
          })),
        );
      }
      for (const item of updated) {
        yield* transaction
          .update(directoryEntities)
          .set({ contentHash: item.contentHash, payload: item.payload, updatedAt: sql`now()` })
          .where(eq(directoryEntities.key, item.key));
      }

      const requiringSources = [...added, ...updated, ...relinked];
      if (requiringSources.length > 0) {
        const keys = requiringSources.map((item) => item.key);
        yield* transaction
          .delete(directoryEntitySources)
          .where(inArray(directoryEntitySources.entityKey, keys));
        const sourceValues = requiringSources.flatMap((item) =>
          item.sourceRecordVersionIds.map((sourceRecordVersionId) => ({
            entityKey: item.key,
            sourceRecordVersionId,
          })),
        );
        if (sourceValues.length > 0) {
          yield* transaction.insert(directoryEntitySources).values(sourceValues);
        }
      }
      if (removed.length > 0) {
        yield* transaction.delete(directoryEntities).where(
          inArray(
            directoryEntities.key,
            removed.map((item) => item.key),
          ),
        );
      }

      for (const link of projection.entityLinks) {
        const row = entityLinkRow(link);
        yield* transaction
          .insert(entityLinks)
          .values(row)
          .onConflictDoUpdate({
            target: [
              entityLinks.dataSourceId,
              entityLinks.entityKind,
              entityLinks.externalId,
              entityLinks.domainEntityKind,
            ],
            set: { domainEntityId: row.domainEntityId, updatedAt: sql`now()` },
          });
      }

      const changes: Array<typeof directoryProjectionChanges.$inferInsert> = [
        ...added.map((item) => ({
          projectionRunId: projectionRun.id,
          entityKey: item.key,
          entityKind: item.entity._tag,
          entityId: item.entity.id,
          changeType: "Added" as const,
          beforeContentHash: null,
          afterContentHash: item.contentHash,
        })),
        ...updated.map((item) => ({
          projectionRunId: projectionRun.id,
          entityKey: item.key,
          entityKind: item.entity._tag,
          entityId: item.entity.id,
          changeType: "Updated" as const,
          beforeContentHash: currentByKey.get(item.key)?.contentHash,
          afterContentHash: item.contentHash,
        })),
        ...removed.map((item) => ({
          projectionRunId: projectionRun.id,
          entityKey: item.key,
          entityKind: item.entityKind,
          entityId: item.entityId,
          changeType: "Removed" as const,
          beforeContentHash: item.contentHash,
          afterContentHash: null,
        })),
        ...relinked.map((item) => ({
          projectionRunId: projectionRun.id,
          entityKey: item.key,
          entityKind: item.entity._tag,
          entityId: item.entity.id,
          changeType: "Relinked" as const,
          beforeContentHash: item.contentHash,
          afterContentHash: item.contentHash,
        })),
      ];
      if (changes.length > 0) yield* transaction.insert(directoryProjectionChanges).values(changes);

      return {
        _tag: changedCount === 0 ? "Unchanged" : "Projected",
        runId: projectionRun.id,
        sourceRunIds: sourceRuns.map((run) => run.id),
        schoolId: projection.schoolId,
        entityCount: incoming.length,
        diagnostics: projection.diagnostics,
        changes: {
          added: added.length,
          updated: updated.length,
          removed: removed.length,
          relinked: relinked.length,
        },
        projectedAt: projectionRun.projectedAt,
      } as const;
    }),
  );
});

/** Reads the server-only directory projection. Authorization precedes any client projection. */
export const readCurrent = Effect.fn("Organization.readCurrentDirectory")(function* (input: {
  readonly dataSourceId: Importing.DataSourceId;
}) {
  const database = yield* Database.Service;
  const rows = yield* database.drizzle
    .select({ key: directoryEntities.key, payload: directoryEntities.payload })
    .from(directoryEntities)
    .where(eq(directoryEntities.dataSourceId, input.dataSourceId))
    .orderBy(directoryEntities.entityKind, directoryEntities.entityId);
  return yield* Effect.forEach(rows, (row) =>
    Schema.decodeUnknownEffect(DirectoryEntity)(row.payload).pipe(
      Effect.mapError((error) =>
        InvalidStoredDirectoryEntity.make({ entityKey: row.key, reason: String(error) }),
      ),
    ),
  );
});

export * as DirectoryProjectionStore from "./directory-projection-store.ts";
