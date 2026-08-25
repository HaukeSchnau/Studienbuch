import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Semaphore from "effect/Semaphore";
import type { Schoolyear } from "webuntis-api";
import { WebUntisImporter } from "./importer.ts";
import { defaultPolicy, pollingWindows, type Policy, type PollingRange } from "./polling-policy.ts";

type Trigger = "startup" | "schedule" | "directory-change";
type Job = "directory" | "recent-and-near-timetable" | "far-timetable" | "course-rosters";

const cadence = (duration: Duration.Duration, jitter: boolean) => {
  const schedule = Schedule.fixed(duration);
  return jitter ? Schedule.jittered(schedule) : schedule;
};

const retrySchedule = (job: Job | "school-year", policy: Policy) => {
  const exponential = Schedule.exponential(policy.retryBaseDelay);
  const delayed = policy.jitter ? Schedule.jittered(exponential) : exponential;
  return delayed.pipe(
    Schedule.tap(({ attempt, duration, input }) =>
      Effect.logWarning("webuntis.poll.retry", {
        event: "webuntis.poll.retry",
        job,
        attempt,
        delay_ms: Duration.toMillis(duration),
        error: String(input),
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
): Effect.Effect<Option.Option<A>, never, R> =>
  Effect.logInfo("webuntis.poll.started", {
    event: "webuntis.poll.started",
    job,
    trigger,
  }).pipe(
    Effect.andThen(withRetries(job, policy, effect)),
    Effect.tap((result) =>
      Effect.logInfo("webuntis.poll.completed", {
        event: "webuntis.poll.completed",
        job,
        trigger,
        result,
      }),
    ),
    Effect.map(Option.some),
    Effect.catchCause((cause) =>
      Effect.logError("webuntis.poll.failed", {
        event: "webuntis.poll.failed",
        job,
        trigger,
        cause: Cause.pretty(cause),
      }).pipe(Effect.as(Option.none<A>())),
    ),
    Effect.annotateLogs({ webuntis_job: job, webuntis_trigger: trigger }),
    Effect.withSpan(`WebUntis.poll.${job}`, {
      attributes: { "webuntis.job": job, "webuntis.trigger": trigger },
    }),
  );

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

/** Runs all current WebUntis sources now, then keeps each source on its own cadence. */
export const run = Effect.fn("WebUntis.runPolling")(function* (policy: Policy = defaultPolicy) {
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
    );
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
          const result = yield* importer.importDirectory(current.name);
          if (trigger !== "startup" && result.projectionChanged) {
            yield* runCourseRosters("directory-change");
          }
          return result;
        }),
      ),
    );
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
    );
  });

  yield* Effect.logInfo("webuntis.worker.started", {
    event: "webuntis.worker.started",
    school_year: initialSchoolYear.name,
    time_zone: policy.timeZone,
  });

  yield* runDirectory("startup");
  yield* runTimetable("recent-and-near-timetable", "startup");
  yield* runTimetable("far-timetable", "startup");
  yield* runCourseRosters("startup");

  return yield* Effect.all(
    [
      Effect.schedule(runDirectory("schedule"), cadence(policy.directoryInterval, policy.jitter)),
      Effect.schedule(
        runTimetable("recent-and-near-timetable", "schedule"),
        cadence(policy.recentAndNearTimetableInterval, policy.jitter),
      ),
      Effect.schedule(
        runTimetable("far-timetable", "schedule"),
        cadence(policy.farTimetableInterval, policy.jitter),
      ),
      Effect.schedule(
        runCourseRosters("schedule"),
        cadence(policy.courseRosterInterval, policy.jitter),
      ),
    ],
    { concurrency: "unbounded", discard: true },
  );
});

export * as WebUntisPolling from "./polling.ts";
