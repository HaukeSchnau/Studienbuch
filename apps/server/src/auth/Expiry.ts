/**
 * Deletes the sessions and short-lived values (email codes, passkey challenges) past their
 * `expiresAt`, which Better Auth refuses from that moment and otherwise deletes only when a request
 * happens to read them: a session unused for 90 days would stay for good. The same hourly run
 * deletes old seal fetches. The privacy notice's "Speicherdauer" promises both.
 */
import * as ClusterCron from "effect/cluster/ClusterCron";
import * as Cron from "effect/Cron";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { Jobs } from "../infra/jobs/Jobs.ts";

export * as Expiry from "./Expiry.ts";

/**
 * Deletes the rows that expired before `now`, by Better Auth's own test: a session counts while
 * `expiresAt` isn't before now, and its cleanup deletes values whose `expiresAt` is. A session's
 * connections closed at its expiry already, so the resolver needs no word of these deletions.
 */
export const sweep = Effect.fn("Expiry.sweep")(function* (now: DateTime.Utc) {
  const sql = yield* SqlClient.SqlClient;
  const before = DateTime.toDateUtc(now);

  yield* sql`delete from auth_session where "expiresAt" < ${before}`;
  yield* sql`delete from auth_verification where "expiresAt" < ${before}`;
});

/**
 * The sweep and `alsoSweep` at every full hour. keys may import auth but not the reverse, so
 * `main.ts` hands over `KeyStore.sweepFetches`. The next run deletes whatever a failed one left.
 */
export const layer = <E, R>(alsoSweep: (now: DateTime.Utc) => Effect.Effect<void, E, R>) =>
  ClusterCron.make({
    name: "expiry",
    cron: Cron.parseUnsafe("0 * * * *"),
    execute: Effect.flatMap(DateTime.now, (now) => Effect.andThen(sweep(now), alsoSweep(now))).pipe(
      Effect.andThen(Jobs.recordRun("expiry")),
    ),
  });
