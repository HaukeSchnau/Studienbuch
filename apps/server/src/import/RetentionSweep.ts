/**
 * The daily sweep (D113): at `hour` in each school's time zone, the lessons `Retention` lets expire
 * go, also from the import's checkpoint, and so do raw reads older than `SourceStore.keptDays`,
 * whether the import runs, is paused, has failed for days or was never set up. A publish removes
 * the same lessons when it runs; the sweep keeps the notice's promise when none does.
 */
import { CivilTime, School, Studienbuch } from "@stu/core";
import { SyncServer } from "@stu/sync/server";
import * as Cause from "effect/Cause";
import * as ClusterCron from "effect/cluster/ClusterCron";
import * as Cron from "effect/Cron";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Jobs } from "../infra/jobs/Jobs.ts";
import { Schools } from "../school/Schools.ts";
import { ImportRun } from "./ImportRun.ts";
import { Retention } from "./Retention.ts";
import { SourceStore } from "./source/SourceStore.ts";

export * as RetentionSweep from "./RetentionSweep.ts";

/**
 * The school's hour of the sweep, before its nightly import. The first hourly slot from then on
 * sweeps, once per date of the school's, so a restart across the hour, or a clock change that skips
 * or repeats it, moves that day's sweep but never drops or doubles it.
 */
export const hour = 3;

/** Whether the school is due at `now`: past `hour`, on a date of its own that `last` isn't on. */
export const due = (
  school: Option.Option<School.Row>,
  now: DateTime.Utc,
  last: Option.Option<DateTime.Utc>,
) => {
  const zone = Option.getOrUndefined(school);
  const { date, time } = School.now(zone, DateTime.toEpochMillis(now));

  const swept = Option.exists(
    last,
    (at) => CivilTime.order(School.today(zone, DateTime.toEpochMillis(at)), date) === 0,
  );

  return time >= hour * 3_600_000 && !swept;
};

/**
 * Removes the school's lessons expired at `now`, drops them from its import's checkpoint, and
 * prunes its raw reads.
 */
export const sweep = Effect.fn("RetentionSweep.sweep")(function* (
  school: School.Id,
  row: Option.Option<School.Row>,
  now: DateTime.Utc,
) {
  const today = School.today(Option.getOrUndefined(row), DateTime.toEpochMillis(now));

  return {
    lessons: yield* Schools.removeLessons(school, Retention.expired(today)),
    checkpoint: yield* ImportRun.trimCheckpoint(
      school,
      CivilTime.format(Retention.oldestKept(today)),
    ),
    versions: yield* SourceStore.prune(school, now),
  };
});

const decodeTagged = Schema.decodeUnknownOption(Schema.Struct({ _tag: Schema.String }));

/** What failed, such as `SqlError`, or `Defect` for a failure without a tag. */
const tagOf = (cause: Cause.Cause<unknown>) =>
  Option.match(decodeTagged(Cause.squash(cause)), {
    onNone: () => "Defect",
    onSome: ({ _tag }) => _tag,
  });

/** A sweep's counts, or the tag of what failed, as `retention_sweep` holds them. */
interface Outcome {
  readonly lessons: number | null;
  readonly checkpoint: number | null;
  readonly versions: number | null;
  readonly failure: string | null;
}

const record = Effect.fn("RetentionSweep.record")(function* (
  school: School.Id,
  now: DateTime.Utc,
  outcome: Outcome,
) {
  const sql = yield* SqlClient.SqlClient;
  const { lessons, checkpoint, versions, failure } = outcome;

  yield* sql`
    insert into retention_sweep (school_id, swept_at, lessons, checkpoint, versions, failure)
    values (${school}, ${DateTime.toDateUtc(now)}, ${lessons}, ${checkpoint}, ${versions}, ${failure})
    on conflict (school_id) do update set swept_at = excluded.swept_at, lessons = excluded.lessons,
      checkpoint = excluded.checkpoint, versions = excluded.versions, failure = excluded.failure
  `;
});

/**
 * Sweeps each school that is due by the clock: every School space, and every school an import ran
 * for, also a dark one without a space. A school whose sweep fails leaves the others to theirs, and
 * its next date tries again.
 */
export const sweepDue = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* DateTime.now;

  const schools = yield* sql<{ readonly id: string; readonly sweptAt: Date | null }>`
    select s.id, r.swept_at as "sweptAt"
    from (
      select id from space where kind = ${School.Space.name}
      union select school_id from import_school
    ) s
    left join retention_sweep r on r.school_id = s.id
    order by s.id
  `.pipe(Effect.orDie);

  for (const { id, sweptAt } of schools) {
    const school = School.Id.make(id);
    const last = Option.map(Option.fromNullishOr(sweptAt), DateTime.fromDateUnsafe);

    yield* Effect.gen(function* () {
      const row = yield* Schools.row(school);

      if (!due(row, now, last)) return;

      const outcome = yield* sweep(school, row, now).pipe(
        Effect.map((counts): Outcome => ({ ...counts, failure: null })),
        Effect.catchCause((cause) =>
          Effect.succeed<Outcome>({
            lessons: null,
            checkpoint: null,
            versions: null,
            failure: tagOf(cause),
          }),
        ),
      );

      yield* record(school, now, outcome);

      yield* (
        outcome.failure === null
          ? Effect.logInfo("Swept a school's past lessons and raw reads")
          : Effect.logWarning("A school's retention sweep failed, and its next date tries again")
      ).pipe(Effect.annotateLogs({ school, ...outcome }));
    }).pipe(
      // Unrecorded, so the next slot tries again.
      Effect.catchCause((cause) =>
        Effect.logWarning("A school's retention sweep didn't run").pipe(
          Effect.annotateLogs({ school, failure: tagOf(cause) }),
        ),
      ),
    );
  }
});

/** The hourly slot that runs `sweepDue`, everywhere jobs run, with or without an import. */
export const layer = ClusterCron.make({
  name: "retention",
  cron: Cron.parseUnsafe("0 * * * *", "UTC"),
  execute: sweepDue.pipe(Effect.andThen(Jobs.recordRun("retention"))),
}).pipe(Layer.provide(SyncServer.writers(Studienbuch.schema)));
