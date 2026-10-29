/**
 * The restore epoch (ADR 0021). `sync_epoch` holds one random id, written when `prepare` first
 * meets the database and rewritten by every restore. The epoch the server reports also carries
 * PostgreSQL's system identifier and timeline, which a restore changes even when nobody rewrote
 * the id: point-in-time recovery ends on a new timeline, and a fresh cluster has a new identifier.
 */
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export * as SyncEpoch from "./SyncEpoch.ts";

/** Writes the id unless one exists. `prepare` runs it after the migrations, every time. */
export const initialize = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql.withTransaction(
    Effect.andThen(
      // Two `prepare` runs at once would each see an empty table.
      sql`lock table sync_epoch in exclusive mode`,
      sql`insert into sync_epoch (id) select gen_random_uuid() where not exists (select from sync_epoch)`,
    ),
  );
}).pipe(Effect.withSpan("SyncEpoch.initialize"));

/** The epoch every pull reports and every push and pull must carry. */
export const current = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly epoch: string | null }>`
    select (select id::text from sync_epoch)
      || ':' || (select system_identifier::text from pg_control_system())
      || ':' || (select timeline_id::text from pg_control_checkpoint()) as epoch
  `;

  return row?.epoch === undefined || row.epoch === null
    ? yield* Effect.die("sync_epoch holds no id. prepare writes it.")
    : row.epoch;
});
