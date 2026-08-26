import { workerJobDuration, workerJobs, workerLastSuccess } from "@stu/observability";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Metric from "effect/Metric";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Semaphore from "effect/Semaphore";
import type { Schoolyear } from "@schnau/webuntis-api";
import { WebUntisImporter } from "./importer.ts";
import { defaultPolicy, pollingWindows, type Policy, type PollingRange } from "./polling-policy.ts";

type Trigger = "startup" | "schedule" | "directory-change" | "one-shot";
export type Job = "directory" | "recent-and-near-timetable" | "far-timetable" | "course-rosters";

export const jobs = [
  "directory",
  "recent-and-near-timetable",
  "far-timetable",
  "course-rosters",
] as const satisfies ReadonlyArray<Job>;

const cadence = (duration: Duration.Duration, jitter: boolean) => {
  const schedule = Schedule.fixed(duration);
  return jitter ? Schedule.jittered(schedule) : schedule;
};

const retrySchedule = (job: Job | "school-year", policy: Policy) => {
  const exponential = Schedule.exponential(policy.retryBaseDelay);
  const delayed = policy.jitter ? Schedule.jittered(exponential) : exponential;
  return delayed.pipe(
    Schedule.tap(({ attempt, duration }) =>
      Effect.logWarning("webuntis.poll.retry", {
        event: "webuntis.poll.retry",
        job,
        attempt,
        delay_ms: Duration.toMillis(duration),
      }),
    ),
  );
};

const withRetries = <A, E, R>(
  job: Job | "school-year",
  policy: Policy,
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.retry({
      times: policy.retryCount,
      schedule: retrySchedule(job, policy),
    }),
  );

const runJob = <A extends object, E, R>(
  job: Job,
  trigger: Trigger,
  policy: Policy,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
  const metric = (outcome: "success" | "failure", durationMillis: number, nowMillis: number) => {
    const attributes = { job, trigger, outcome };
    return Effect.all([
      Metric.update(Metric.withAttributes(workerJobs, attributes), 1),
      Metric.update(Metric.withAttributes(workerJobDuration, attributes), durationMillis),
      outcome === "success"
        ? Metric.update(Metric.withAttributes(workerLastSuccess, { job }), nowMillis / 1_000)
        : Effect.void,
    ]).pipe(Effect.asVoid);
  };

  return Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    yield* Effect.logInfo("webuntis.poll.started", {
      event: "webuntis.poll.started",
      job,
      trigger,
    });
    return yield* withRetries(job, policy, effect).pipe(
      Effect.tap(() =>
        Effect.logInfo("webuntis.poll.completed", {
          event: "webuntis.poll.completed",
          job,
          trigger,
        }),
      ),
      Effect.onExit((exit) =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((endedAt) =>
            metric(
              exit._tag === "Success" ? "success" : "failure",
              Math.max(0, endedAt - startedAt),
              endedAt,
            ),
          ),
        ),
      ),
      Effect.tapCause((cause) =>
        Effect.logError("webuntis.poll.failed", {
          event: "webuntis.poll.failed",
          job,
          trigger,
          error_type: Cause.hasInterruptsOnly(cause) ? "interrupt" : "failure",
        }),
      ),
    );
  }).pipe(
    Effect.annotateLogs({ webuntis_job: job, webuntis_trigger: trigger }),
    Effect.withSpan(`WebUntis.poll.${job}`, {
      attributes: { "webuntis.job": job, "webuntis.trigger": trigger },
    }),
  );
};

const logSkippedRange = (job: Job, trigger: Trigger, schoolYear: string) =>
  Effect.logInfo("webuntis.poll.skipped", {
    event: "webuntis.poll.skipped",
    job,
    trigger,
    school_year: schoolYear,
    reason: "outside-current-school-year",
  });

const currentLocalDate = (timeZone: DateTime.TimeZone) =>
  DateTime.now.pipe(
    Effect.map((now) => DateTime.setZone(now, timeZone)),
    Effect.map(DateTime.formatIsoDate),
  );

const makeRunner = Effect.fn("WebUntis.makePollingRunner")(function* (
  policy: Policy = defaultPolicy,
) {
  const importer = yield* WebUntisImporter.Service;
  const timeZone = yield* DateTime.zoneMakeNamedEffect(policy.timeZone);
  const initialSchoolYear = yield* withRetries("school-year", policy, importer.currentSchoolYear);
  const schoolYear = yield* Ref.make<Schoolyear>(initialSchoolYear);
  const directoryLock = yield* Semaphore.make(1);
  const timetableLock = yield* Semaphore.make(1);
  const courseRosterLock = yield* Semaphore.make(1);

  const rangeFor = Effect.fn("WebUntis.pollingRangeFor")(function* (
    select: (windows: ReturnType<typeof pollingWindows>) => PollingRange | undefined,
  ) {
    const [today, current] = yield* Effect.all([currentLocalDate(timeZone), Ref.get(schoolYear)]);
    return { current, range: select(pollingWindows(today, current, policy)) } as const;
  });

  const runCourseRosters = Effect.fn("WebUntis.pollCourseRosters")(function* (trigger: Trigger) {
    const { current, range } = yield* rangeFor((windows) => windows.courseRosters);
    if (range === undefined) {
      yield* logSkippedRange("course-rosters", trigger, current.name);
      return Option.none<WebUntisImporter.CourseRosterImportSummary>();
    }
    return yield* runJob(
      "course-rosters",
      trigger,
      policy,
      Semaphore.withPermit(
        courseRosterLock,
        importer.importCourseRosters(range.schoolYear, range.start, range.end),
      ),
    ).pipe(Effect.map(Option.some));
  });

  const runDirectory = Effect.fn("WebUntis.pollDirectory")(function* (trigger: Trigger) {
    return yield* runJob(
      "directory",
      trigger,
      policy,
      Semaphore.withPermit(
        directoryLock,
        Effect.gen(function* () {
          const current = yield* importer.currentSchoolYear;
          yield* Ref.set(schoolYear, current);
          return yield* importer.importDirectory(current.name);
        }),
      ),
    ).pipe(Effect.map(Option.some));
  });

  const runTimetable = Effect.fn("WebUntis.pollTimetable")(function* (
    job: "recent-and-near-timetable" | "far-timetable",
    trigger: Trigger,
  ) {
    const { current, range } = yield* rangeFor((windows) =>
      job === "recent-and-near-timetable" ? windows.recentAndNearTimetable : windows.farTimetable,
    );
    if (range === undefined) {
      yield* logSkippedRange(job, trigger, current.name);
      return Option.none<WebUntisImporter.TimetableImportSummary>();
    }
    return yield* runJob(
      job,
      trigger,
      policy,
      Semaphore.withPermit(
        timetableLock,
        importer.importTimetable(range.schoolYear, range.start, range.end),
      ),
    ).pipe(Effect.map(Option.some));
  });

  return {
    initialSchoolYear,
    runCourseRosters,
    runDirectory,
    runTimetable,
  } as const;
});

const tolerateFailure = <A, E, R>(effect: Effect.Effect<Option.Option<A>, E, R>) =>
  effect.pipe(Effect.catchCause(() => Effect.succeed(Option.none<A>())));

/** Runs one bounded polling job and preserves failures for the process exit status. */
export const runOnce = Effect.fn("WebUntis.runPollingOnce")(function* (
  job: Job,
  policy: Policy = defaultPolicy,
) {
  const runner = yield* makeRunner(policy);
  switch (job) {
    case "directory": {
      const result = yield* runner.runDirectory("one-shot");
      if (Option.isSome(result) && result.value.projectionChanged) {
        yield* runner.runCourseRosters("directory-change");
      }
      return result;
    }
    case "recent-and-near-timetable":
      return yield* runner.runTimetable(job, "one-shot");
    case "far-timetable":
      return yield* runner.runTimetable(job, "one-shot");
    case "course-rosters":
      return yield* runner.runCourseRosters("one-shot");
  }
});

/** Runs all current WebUntis sources now, then keeps each source on its own cadence. */
export const run = Effect.fn("WebUntis.runPolling")(function* (policy: Policy = defaultPolicy) {
  const runner = yield* makeRunner(policy);

  const runDirectoryAndRefreshCourseRosters = Effect.fn(
    "WebUntis.pollDirectoryAndRefreshCourseRosters",
  )(function* () {
    const result = yield* tolerateFailure(runner.runDirectory("schedule"));
    if (Option.isSome(result) && result.value.projectionChanged) {
      yield* tolerateFailure(runner.runCourseRosters("directory-change"));
    }
  });

  yield* Effect.logInfo("webuntis.worker.started", {
    event: "webuntis.worker.started",
    school_year: runner.initialSchoolYear.name,
    time_zone: policy.timeZone,
  });

  yield* tolerateFailure(runner.runDirectory("startup"));
  yield* tolerateFailure(runner.runTimetable("recent-and-near-timetable", "startup"));
  yield* tolerateFailure(runner.runTimetable("far-timetable", "startup"));
  yield* tolerateFailure(runner.runCourseRosters("startup"));

  return yield* Effect.all(
    [
      Effect.schedule(
        runDirectoryAndRefreshCourseRosters(),
        cadence(policy.directoryInterval, policy.jitter),
      ),
      Effect.schedule(
        tolerateFailure(runner.runTimetable("recent-and-near-timetable", "schedule")),
        cadence(policy.recentAndNearTimetableInterval, policy.jitter),
      ),
      Effect.schedule(
        tolerateFailure(runner.runTimetable("far-timetable", "schedule")),
        cadence(policy.farTimetableInterval, policy.jitter),
      ),
      Effect.schedule(
        tolerateFailure(runner.runCourseRosters("schedule")),
        cadence(policy.courseRosterInterval, policy.jitter),
      ),
    ],
    { concurrency: "unbounded", discard: true },
  );
});

export * as WebUntisPolling from "./polling.ts";
