/**
 * Who may read a school's WebUntis now (m2-import-path.md, section 2): one run at a time under a
 * lease that only its own claim clears, and a pause that waits for the lease and stops new claims.
 */
import type { School } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

export * as Lease from "./Lease.ts";

/**
 * How long a lease lasts: a run is interrupted by then, and its lease passes. A request sent just
 * before can still be on the wire when a pause returns. A run sends its one login first, so that
 * is a read unless the run took this long to start (m2-import-path.md, slice 3).
 */
export const deadline = Duration.minutes(5);

/** Another run holds the lease. */
export class Busy extends Schema.TaggedError<Busy, { readonly brand: unique symbol }>()(
  "Lease.Busy",
  {},
) {}

/** The import is paused, and no run may start. */
export class Paused extends Schema.TaggedError<Paused, { readonly brand: unique symbol }>()(
  "Lease.Paused",
  { by: Schema.String },
) {}

/** Someone else holds the pause, so a second test can't believe it owns the account too. */
export class PausedByOther extends Schema.TaggedError<
  PausedByOther,
  { readonly brand: unique symbol }
>()("Lease.PausedByOther", { by: Schema.String }) {}

/** Only the owner of a pause resumes it. */
export class NotPausedBy extends Schema.TaggedError<
  NotPausedBy,
  { readonly brand: unique symbol }
>()("Lease.NotPausedBy", { by: Schema.String }) {}

/** A claimed lease and the checkpoint the run builds on, as the database holds it. */
export interface Claim {
  /** This claim's own id, which alone may clear the lease. */
  readonly owner: string;
  readonly until: DateTime.Utc;
  readonly revision: number;
  /** An `ImportResult` as JSON, absent before the first checkpoint. */
  readonly previous: unknown;
  /** `Projection.Candidate`s as JSON. */
  readonly pending: unknown;
  /** The self-check's `SelfCheck.Kept` Kurswahlen as JSON. */
  readonly kurswahl: unknown;
}

const row = (school: School.Id) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql`insert into import_school (school_id) values (${school}) on conflict do nothing`,
  );

const state = (school: School.Id) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly pausedBy: string | null; readonly leaseUntil: Date | null }>`
      select paused_by as "pausedBy", lease_until as "leaseUntil"
      from import_school where school_id = ${school}
    `,
  ).pipe(Effect.map(([current]) => current));

/**
 * Takes the school's lease until the deadline, when the import isn't paused and no other lease is
 * current, and returns the checkpoint with it. The check and the claim are one statement, so a
 * pause written first stops the claim, and a claim written first makes the pause wait.
 */
export const claim = Effect.fn("Lease.claim")(
  function* (school: School.Id) {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* DateTime.now;
    const until = DateTime.addDuration(now, deadline);

    yield* row(school);

    const [claimed] = yield* sql<{
      readonly owner: string;
      readonly revision: number;
      readonly previous: unknown;
      readonly pending: unknown;
      readonly kurswahl: unknown;
    }>`
      update import_school
      set lease_until = ${DateTime.toDateUtc(until)}, lease_owner = gen_random_uuid()
      where school_id = ${school} and paused_by is null
        and (lease_until is null or lease_until <= ${DateTime.toDateUtc(now)})
      returning lease_owner::text as owner, revision, previous, pending, kurswahl
    `;

    if (claimed !== undefined) return { ...claimed, until } satisfies Claim;

    const current = yield* state(school);

    const pausedBy = current?.pausedBy ?? null;

    return yield* pausedBy === null ? new Busy() : new Paused({ by: pausedBy });
  },
  Effect.catchTags({ SqlError: Effect.die }),
);

/**
 * Clears the lease if `owner`'s claim still holds it, and leaves a later claim's alone. When the
 * row stays locked or the database fails, the lease passes at its deadline instead, and the run
 * that ends doesn't wait for it, so its cron's next slot comes on time.
 */
export const release = Effect.fn("Lease.release")(
  function* (school: School.Id, owner: string) {
    const sql = yield* SqlClient.SqlClient;

    yield* sql.withTransaction(
      Effect.andThen(
        sql`set local lock_timeout = '2s'`,
        sql`
          update import_school set lease_until = null, lease_owner = null
          where school_id = ${school} and lease_owner = ${owner}::uuid
        `,
      ),
    );
  },
  // Also a rollback on a dead connection, which dies: the run's outcome and pause still follow.
  Effect.catchCause(() =>
    Effect.logWarning("A run's lease couldn't be cleared, so it passes at its deadline"),
  ),
);

const passed = (until: Date | null, now: DateTime.Utc) =>
  until === null || !DateTime.isLessThan(now, DateTime.fromDateUnsafe(until));

/** Whether no lease is current, so no run of the school reads now. */
export const drained = Effect.fn("Lease.drained")(function* (school: School.Id) {
  return passed((yield* state(school))?.leaseUntil ?? null, yield* DateTime.now);
}, Effect.orDie);

/**
 * Pauses the school's import for `by`, such as a live test's ref, and waits until the lease has
 * passed, at most the deadline. When it returns, no run reads and none will start. Pausing again
 * with the same owner waits again.
 */
export const pause = Effect.fn("Lease.pause")(
  function* (school: School.Id, by: string) {
    const sql = yield* SqlClient.SqlClient;
    const now = yield* DateTime.now;

    yield* row(school);

    const [paused] = yield* sql`
      update import_school set paused_by = ${by}, paused_at = ${DateTime.toDateUtc(now)}
      where school_id = ${school} and (paused_by is null or paused_by = ${by})
      returning 1
    `;

    if (paused === undefined) {
      return yield* new PausedByOther({ by: (yield* state(school))?.pausedBy ?? "" });
    }

    // Each look reads the pause and the lease from one row: once its owner resumed, the pause it
    // waits for is gone. A lease ends by its deadline at the latest, so this ends in five minutes.
    // The clock is read first, so a lease that passed by then had passed when the row was read.
    const look = Effect.gen(function* () {
      const now = yield* DateTime.now;
      const current = yield* state(school);

      if (current?.pausedBy !== by) return yield* new NotPausedBy({ by });

      return passed(current.leaseUntil, now);
    });

    yield* look.pipe(
      Effect.repeat({ schedule: Schedule.spaced("1 second"), until: (done) => done }),
    );
  },
  Effect.catchTags({ SqlError: Effect.die }),
);

/** Ends `by`'s pause. Another owner's pause stays, and so does the import's own. */
export const resume = Effect.fn("Lease.resume")(
  function* (school: School.Id, by: string) {
    const sql = yield* SqlClient.SqlClient;

    const [resumed] = yield* sql`
      update import_school set paused_by = null, paused_at = null
      where school_id = ${school} and paused_by = ${by}
      returning 1
    `;

    if (resumed === undefined) return yield* new NotPausedBy({ by });
  },
  Effect.catchTags({ SqlError: Effect.die }),
);
