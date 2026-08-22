import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Database } from "../database/client.ts";
import type { DirectoryObservation, DirectorySnapshot } from "../webuntis/directory-snapshot.ts";
import { hashDirectoryObservations } from "../webuntis/directory-snapshot.ts";
import { sourceImportRuns, sourceObservations } from "./schema.ts";

export class DirectoryNotReady extends Schema.TaggedError<DirectoryNotReady>()(
  "Importing.DirectoryNotReady",
  {
    dataSourceId: Schema.String,
    errorCodes: Schema.Array(Schema.String),
  },
) {}

export interface DirectoryImportResult {
  readonly _tag: "Imported" | "Unchanged";
  readonly runId: string;
  readonly contentHash: string;
  readonly observationCount: number;
  readonly observedAt: Date;
}

const scopeOf = (snapshot: DirectorySnapshot) =>
  `academic-year:${snapshot.preview.academicYear.externalId}`;

const scopeCondition = (snapshot: DirectorySnapshot) =>
  and(
    eq(sourceImportRuns.dataSourceId, snapshot.preview.dataSourceId),
    eq(sourceImportRuns.dataset, "directory"),
    eq(sourceImportRuns.scope, scopeOf(snapshot)),
  );

const chunksOf = <Value>(
  values: ReadonlyArray<Value>,
  size: number,
): Array<ReadonlyArray<Value>> => {
  const chunks: Array<ReadonlyArray<Value>> = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const observationRow = (runId: string, observation: DirectoryObservation) => ({
  runId,
  entityKind: observation._tag,
  externalId: observation.externalId,
  contentHash: hashDirectoryObservations([observation]),
  payload: observation.payload,
});

/**
 * Stores a complete directory snapshot and atomically makes it current.
 *
 * The caller must finish all provider requests first. This function only holds the transaction
 * while it locks one source scope and writes PostgreSQL rows.
 */
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

  const database = yield* Database.Service;
  const scope = scopeOf(snapshot);
  const lockKey = JSON.stringify([snapshot.preview.dataSourceId, "directory", scope]);

  return yield* database.drizzle.transaction((transaction) =>
    Effect.gen(function* () {
      yield* transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );

      const currentRows = yield* transaction
        .select({
          id: sourceImportRuns.id,
          contentHash: sourceImportRuns.contentHash,
          observationCount: sourceImportRuns.observationCount,
          observedAt: sourceImportRuns.observedAt,
        })
        .from(sourceImportRuns)
        .where(and(scopeCondition(snapshot), eq(sourceImportRuns.isCurrent, true)))
        .limit(1);
      const current = currentRows[0];

      if (current?.contentHash === snapshot.contentHash) {
        return {
          _tag: "Unchanged",
          runId: current.id,
          contentHash: current.contentHash,
          observationCount: current.observationCount,
          observedAt: current.observedAt,
        } satisfies DirectoryImportResult;
      }

      const insertedRuns = yield* transaction
        .insert(sourceImportRuns)
        .values({
          provider: snapshot.preview.provider,
          dataSourceId: snapshot.preview.dataSourceId,
          dataset: "directory",
          scope,
          contentHash: snapshot.contentHash,
          completeness: "Complete",
          observationCount: snapshot.observations.length,
          counts: snapshot.preview.wouldImport,
          diagnostics: snapshot.preview.diagnostics,
          isCurrent: false,
        })
        .returning({ id: sourceImportRuns.id, observedAt: sourceImportRuns.observedAt });
      const inserted = insertedRuns[0];
      if (inserted === undefined) {
        return yield* Effect.die("PostgreSQL did not return the inserted import run");
      }

      for (const observations of chunksOf(snapshot.observations, 500)) {
        yield* transaction
          .insert(sourceObservations)
          .values(observations.map((observation) => observationRow(inserted.id, observation)));
      }

      yield* transaction
        .update(sourceImportRuns)
        .set({ isCurrent: false })
        .where(and(scopeCondition(snapshot), eq(sourceImportRuns.isCurrent, true)));
      yield* transaction
        .update(sourceImportRuns)
        .set({ isCurrent: true })
        .where(eq(sourceImportRuns.id, inserted.id));

      return {
        _tag: "Imported",
        runId: inserted.id,
        contentHash: snapshot.contentHash,
        observationCount: snapshot.observations.length,
        observedAt: inserted.observedAt,
      } satisfies DirectoryImportResult;
    }),
  );
});

export * as SourceObservationStore from "./source-observation-store.ts";
