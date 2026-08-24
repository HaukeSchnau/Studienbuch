import type { ExternalEntityKind } from "@stu/core/importing";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Database } from "../database/client.ts";
import type { DirectorySnapshot } from "../webuntis/directory-snapshot.ts";
import {
  sourceChanges,
  sourceImportRuns,
  sourceRecords,
  sourceRecordVersions,
  type SourceChangeType,
} from "./schema.ts";
import {
  hashSourceObservation,
  type SourceRecordObservation,
  type SourceSnapshot,
} from "./source-snapshot.ts";

export class DirectoryNotReady extends Schema.TaggedError<DirectoryNotReady>()(
  "Importing.DirectoryNotReady",
  {
    dataSourceId: Schema.String,
    errorCodes: Schema.Array(Schema.String),
  },
) {}

export class DuplicateSourceIdentity extends Schema.TaggedError<DuplicateSourceIdentity>()(
  "Importing.DuplicateSourceIdentity",
  {
    dataSourceId: Schema.String,
    dataset: Schema.String,
    scope: Schema.String,
    entityKind: Schema.String,
    externalId: Schema.String,
  },
) {}

export class MissingSourceRecordVersion extends Schema.TaggedError<MissingSourceRecordVersion>()(
  "Importing.MissingSourceRecordVersion",
  {
    entityKind: Schema.String,
    externalId: Schema.String,
    contentHash: Schema.String,
  },
) {}

export interface SourceImportResult {
  readonly _tag: "Imported" | "Unchanged";
  readonly runId: string;
  readonly contentHash: string;
  readonly observationCount: number;
  readonly changes: {
    readonly added: number;
    readonly updated: number;
    readonly removed: number;
    readonly reactivated: number;
  };
  readonly observedAt: Date;
}

interface PreparedObservation {
  readonly observation: SourceRecordObservation;
  readonly identityKey: string;
  readonly contentHash: string;
}

interface CurrentRecord {
  readonly entityKind: ExternalEntityKind;
  readonly externalId: string;
  readonly currentVersionId: string;
  readonly contentHash: string;
  readonly active: boolean;
}

interface IncomingChange {
  readonly changeType: Exclude<SourceChangeType, "Removed">;
  readonly incoming: PreparedObservation;
  readonly before: CurrentRecord | undefined;
}

const identityKey = (entityKind: ExternalEntityKind, externalId: string) =>
  `${entityKind}\u0000${externalId}`;

const versionKey = (entityKind: ExternalEntityKind, externalId: string, contentHash: string) =>
  `${identityKey(entityKind, externalId)}\u0000${contentHash}`;

const chunksOf = <Value>(values: ReadonlyArray<Value>, size: number): Array<Array<Value>> => {
  const chunks: Array<Array<Value>> = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const runScopeCondition = (snapshot: SourceSnapshot<SourceRecordObservation>) =>
  and(
    eq(sourceImportRuns.dataSourceId, snapshot.dataSourceId),
    eq(sourceImportRuns.dataset, snapshot.dataset),
    eq(sourceImportRuns.scope, snapshot.scope),
  );

const recordScopeCondition = (snapshot: SourceSnapshot<SourceRecordObservation>) =>
  and(
    eq(sourceRecords.dataSourceId, snapshot.dataSourceId),
    eq(sourceRecords.dataset, snapshot.dataset),
    eq(sourceRecords.scope, snapshot.scope),
  );

const versionScopeCondition = (snapshot: SourceSnapshot<SourceRecordObservation>) =>
  and(
    eq(sourceRecordVersions.dataSourceId, snapshot.dataSourceId),
    eq(sourceRecordVersions.dataset, snapshot.dataset),
    eq(sourceRecordVersions.scope, snapshot.scope),
  );

const recordIdentityCondition = (
  snapshot: SourceSnapshot<SourceRecordObservation>,
  entityKind: ExternalEntityKind,
  externalId: string,
) =>
  and(
    recordScopeCondition(snapshot),
    eq(sourceRecords.entityKind, entityKind),
    eq(sourceRecords.externalId, externalId),
  );

const prepareObservations = <Observation extends SourceRecordObservation>(
  snapshot: SourceSnapshot<Observation>,
) => {
  const byIdentity = new Map<string, PreparedObservation>();
  for (const observation of snapshot.observations) {
    const key = identityKey(observation._tag, observation.externalId);
    if (byIdentity.has(key)) {
      return DuplicateSourceIdentity.make({
        dataSourceId: snapshot.dataSourceId,
        dataset: snapshot.dataset,
        scope: snapshot.scope,
        entityKind: observation._tag,
        externalId: observation.externalId,
      });
    }
    byIdentity.set(key, {
      observation,
      identityKey: key,
      contentHash: hashSourceObservation(observation),
    });
  }
  return byIdentity;
};

/**
 * Reconciles one provider scope without copying unchanged payloads.
 *
 * Provider requests and decoding finish before this function starts. The transaction serializes
 * one source scope, stores new record versions, updates current pointers, and records changes.
 */
export const persistSourceSnapshot = Effect.fn("Importing.persistSourceSnapshot")(function* <
  Observation extends SourceRecordObservation,
>(snapshot: SourceSnapshot<Observation>) {
  const prepared = prepareObservations(snapshot);
  if (!(prepared instanceof Map)) return yield* prepared;

  const database = yield* Database.Service;
  const lockKey = JSON.stringify([snapshot.dataSourceId, snapshot.dataset, snapshot.scope]);

  return yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      yield* transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );

      const currentRows = yield* transaction
        .select({
          entityKind: sourceRecords.entityKind,
          externalId: sourceRecords.externalId,
          currentVersionId: sourceRecords.currentVersionId,
          contentHash: sourceRecordVersions.contentHash,
          active: sourceRecords.active,
        })
        .from(sourceRecords)
        .innerJoin(
          sourceRecordVersions,
          eq(sourceRecordVersions.id, sourceRecords.currentVersionId),
        )
        .where(recordScopeCondition(snapshot));
      const currentByIdentity = new Map(
        currentRows.map((record) => [identityKey(record.entityKind, record.externalId), record]),
      );

      const incomingChanges: Array<IncomingChange> = [];
      for (const incoming of prepared.values()) {
        const before = currentByIdentity.get(incoming.identityKey);
        if (before === undefined) {
          incomingChanges.push({ changeType: "Added", incoming, before });
        } else if (!before.active) {
          incomingChanges.push({ changeType: "Reactivated", incoming, before });
        } else if (before.contentHash !== incoming.contentHash) {
          incomingChanges.push({ changeType: "Updated", incoming, before });
        }
      }
      const removed =
        snapshot.completeness === "Complete"
          ? currentRows.filter(
              (record) =>
                record.active && !prepared.has(identityKey(record.entityKind, record.externalId)),
            )
          : [];
      const addedCount = incomingChanges.filter((change) => change.changeType === "Added").length;
      const updatedCount = incomingChanges.filter(
        (change) => change.changeType === "Updated",
      ).length;
      const reactivatedCount = incomingChanges.filter(
        (change) => change.changeType === "Reactivated",
      ).length;
      const removedCount = removed.length;
      const outcome = incomingChanges.length + removedCount === 0 ? "Unchanged" : "Changed";

      const insertedRuns = yield* transaction
        .insert(sourceImportRuns)
        .values({
          provider: snapshot.provider,
          dataSourceId: snapshot.dataSourceId,
          dataset: snapshot.dataset,
          scope: snapshot.scope,
          contentHash: snapshot.contentHash,
          completeness: snapshot.completeness,
          outcome,
          observationCount: snapshot.observations.length,
          addedCount,
          updatedCount,
          removedCount,
          reactivatedCount,
          counts: snapshot.counts,
          diagnostics: snapshot.diagnostics,
          isCurrent: false,
        })
        .returning({ id: sourceImportRuns.id, observedAt: sourceImportRuns.observedAt });
      const insertedRun = insertedRuns[0];
      if (insertedRun === undefined) {
        return yield* Effect.die("PostgreSQL did not return the inserted import run");
      }

      const changesNeedingVersion = incomingChanges.filter(
        (change) => change.before?.contentHash !== change.incoming.contentHash,
      );
      const versionIds = new Map<string, string>();
      for (const change of incomingChanges) {
        if (change.before?.contentHash === change.incoming.contentHash) {
          versionIds.set(
            versionKey(
              change.incoming.observation._tag,
              change.incoming.observation.externalId,
              change.incoming.contentHash,
            ),
            change.before.currentVersionId,
          );
        }
      }

      for (const versionChunk of chunksOf(changesNeedingVersion, 500)) {
        const insertedVersions = yield* transaction
          .insert(sourceRecordVersions)
          .values(
            versionChunk.map(({ incoming }) => ({
              dataSourceId: snapshot.dataSourceId,
              dataset: snapshot.dataset,
              scope: snapshot.scope,
              entityKind: incoming.observation._tag,
              externalId: incoming.observation.externalId,
              contentHash: incoming.contentHash,
              payload: incoming.observation.payload,
              firstObservedInRunId: insertedRun.id,
            })),
          )
          .onConflictDoNothing()
          .returning({
            id: sourceRecordVersions.id,
            entityKind: sourceRecordVersions.entityKind,
            externalId: sourceRecordVersions.externalId,
            contentHash: sourceRecordVersions.contentHash,
          });
        for (const version of insertedVersions) {
          versionIds.set(
            versionKey(version.entityKind, version.externalId, version.contentHash),
            version.id,
          );
        }
      }

      const unresolvedHashes = changesNeedingVersion
        .filter(
          ({ incoming }) =>
            !versionIds.has(
              versionKey(
                incoming.observation._tag,
                incoming.observation.externalId,
                incoming.contentHash,
              ),
            ),
        )
        .map(({ incoming }) => incoming.contentHash);
      if (unresolvedHashes.length > 0) {
        const existingVersions = yield* transaction
          .select({
            id: sourceRecordVersions.id,
            entityKind: sourceRecordVersions.entityKind,
            externalId: sourceRecordVersions.externalId,
            contentHash: sourceRecordVersions.contentHash,
          })
          .from(sourceRecordVersions)
          .where(
            and(
              versionScopeCondition(snapshot),
              inArray(sourceRecordVersions.contentHash, unresolvedHashes),
            ),
          );
        for (const version of existingVersions) {
          versionIds.set(
            versionKey(version.entityKind, version.externalId, version.contentHash),
            version.id,
          );
        }
      }

      const resolvedIncomingChanges: Array<IncomingChange & { readonly afterVersionId: string }> =
        [];
      for (const change of incomingChanges) {
        const afterVersionId = versionIds.get(
          versionKey(
            change.incoming.observation._tag,
            change.incoming.observation.externalId,
            change.incoming.contentHash,
          ),
        );
        if (afterVersionId === undefined) {
          return yield* MissingSourceRecordVersion.make({
            entityKind: change.incoming.observation._tag,
            externalId: change.incoming.observation.externalId,
            contentHash: change.incoming.contentHash,
          });
        }
        resolvedIncomingChanges.push({ ...change, afterVersionId });
      }

      const added = resolvedIncomingChanges.filter((change) => change.changeType === "Added");
      for (const addedChunk of chunksOf(added, 500)) {
        yield* transaction.insert(sourceRecords).values(
          addedChunk.map((change) => ({
            dataSourceId: snapshot.dataSourceId,
            dataset: snapshot.dataset,
            scope: snapshot.scope,
            entityKind: change.incoming.observation._tag,
            externalId: change.incoming.observation.externalId,
            currentVersionId: change.afterVersionId,
            active: true,
            firstSeenInRunId: insertedRun.id,
            lastChangedInRunId: insertedRun.id,
          })),
        );
      }

      for (const change of resolvedIncomingChanges) {
        if (change.changeType === "Added") continue;
        yield* transaction
          .update(sourceRecords)
          .set({
            currentVersionId: change.afterVersionId,
            active: true,
            lastChangedInRunId: insertedRun.id,
            updatedAt: sql`now()`,
          })
          .where(
            recordIdentityCondition(
              snapshot,
              change.incoming.observation._tag,
              change.incoming.observation.externalId,
            ),
          );
      }
      for (const record of removed) {
        yield* transaction
          .update(sourceRecords)
          .set({ active: false, lastChangedInRunId: insertedRun.id, updatedAt: sql`now()` })
          .where(recordIdentityCondition(snapshot, record.entityKind, record.externalId));
      }

      const changeRows: Array<typeof sourceChanges.$inferInsert> = [
        ...resolvedIncomingChanges.map((change) => ({
          runId: insertedRun.id,
          entityKind: change.incoming.observation._tag,
          externalId: change.incoming.observation.externalId,
          changeType: change.changeType,
          beforeVersionId: change.before?.currentVersionId ?? null,
          afterVersionId: change.afterVersionId,
        })),
        ...removed.map((record) => ({
          runId: insertedRun.id,
          entityKind: record.entityKind,
          externalId: record.externalId,
          changeType: "Removed" as const,
          beforeVersionId: record.currentVersionId,
          afterVersionId: null,
        })),
      ];
      for (const changeChunk of chunksOf(changeRows, 500)) {
        yield* transaction.insert(sourceChanges).values(changeChunk);
      }

      yield* transaction
        .update(sourceImportRuns)
        .set({ isCurrent: false })
        .where(and(runScopeCondition(snapshot), eq(sourceImportRuns.isCurrent, true)));
      yield* transaction
        .update(sourceImportRuns)
        .set({ isCurrent: true })
        .where(eq(sourceImportRuns.id, insertedRun.id));

      return {
        _tag: outcome === "Changed" ? "Imported" : "Unchanged",
        runId: insertedRun.id,
        contentHash: snapshot.contentHash,
        observationCount: snapshot.observations.length,
        changes: {
          added: addedCount,
          updated: updatedCount,
          removed: removedCount,
          reactivated: reactivatedCount,
        },
        observedAt: insertedRun.observedAt,
      } satisfies SourceImportResult;
    }),
  );
});

export const persistDirectorySnapshot = Effect.fn("Importing.persistDirectorySnapshot")(function* (
  snapshot: DirectorySnapshot,
) {
  if (!snapshot.preview.complete || !snapshot.preview.ready) {
    return yield* DirectoryNotReady.make({
      dataSourceId: snapshot.preview.dataSourceId,
      errorCodes: snapshot.preview.diagnostics
        .filter((diagnostic) => diagnostic.severity === "Error")
        .map((diagnostic) => diagnostic.code),
    });
  }

  return yield* persistSourceSnapshot({
    provider: snapshot.preview.provider,
    dataSourceId: snapshot.preview.dataSourceId,
    dataset: "directory",
    scope: `academic-year:${snapshot.preview.academicYear.externalId}`,
    contentHash: snapshot.contentHash,
    completeness: "Complete",
    observations: snapshot.observations,
    counts: snapshot.preview.wouldImport,
    diagnostics: snapshot.preview.diagnostics,
  });
});

export * as SourceObservationStore from "./source-observation-store.ts";
