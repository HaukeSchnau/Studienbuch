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
 * The school's hour of the sweep: before its nightly import, and an hour that German clock changes
 * neither skip nor repeat, so it comes once every day.
 */
export const hour = 3;

/** Whether the hourly slot at `at` falls in the school's `hour`, in its zone or the default one. */
export const due = (school: Option.Option<School.Row>, at: DateTime.Utc) => {
  const { time } = School.now(Option.getOrUndefined(school), DateTime.toEpochMillis(at));

  return Math.floor(time / 3_600_000) === hour;
};

/**
 * Removes the school's expired lessons, drops them from its import's checkpoint, and prunes its
 * raw reads, by the clock.
 */
export const sweep = Effect.fn("RetentionSweep.sweep")(function* (
  school: School.Id,
  row: Option.Option<School.Row>,
) {
  const now = yield* DateTime.now;
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

/**
 * Sweeps each school that the slot at `at` is due for: every School space, and every school an
 * import ran for, also a dark one without a space. A school whose sweep fails leaves the others to
 * theirs, and its next day's slot tries again.
 */
export const sweepDue = Effect.fn("RetentionSweep.sweepDue")(function* (at: DateTime.Utc) {
  const sql = yield* SqlClient.SqlClient;

  const schools = yield* sql<{ readonly id: string }>`
    select id from space where kind = ${School.Space.name}
    union select school_id from import_school
    order by id
  `.pipe(Effect.orDie);

  for (const { id } of schools) {
    const school = School.Id.make(id);

    yield* Effect.gen(function* () {
      const row = yield* Schools.row(school);

      if (!due(row, at)) return;

      const swept = yield* sweep(school, row);

      yield* Effect.logInfo("Swept a school's past lessons and raw reads").pipe(
        Effect.annotateLogs({ school, ...swept }),
      );
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("A school's retention sweep failed, and tomorrow's tries again").pipe(
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
  execute: Effect.gen(function* () {
    yield* sweepDue(yield* ClusterCron.CurrentScheduledTime);
    yield* Jobs.recordRun("retention");
  }),
}).pipe(Layer.provide(SyncServer.writers(Studienbuch.schema)));
