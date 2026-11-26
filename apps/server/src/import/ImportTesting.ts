/** The naive import on a recorded corpus, at a fixed time, for the import's own tests. */
import { WebUntisClient } from "@schnau/webuntis-api";
import { CivilTime, School } from "@stu/core";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";
import type { Corpus } from "./corpus/Corpus.ts";
import { TinySchool } from "./evaluation/TinySchool.ts";
import { NaiveImport } from "./NaiveImport.ts";
import { SchoolImport } from "./SchoolImport.ts";

export * as ImportTesting from "./ImportTesting.ts";

/** 06:00 and noon on Monday of 2026-W45, the invented school's second captured week. */
export const morning = DateTime.makeUnsafe("2026-11-02T05:00:00Z");
export const noon = DateTime.makeUnsafe("2026-11-02T11:00:00Z");

export const today = CivilTime.dateIn(DateTime.toEpochMillis(morning), School.defaultTimeZone);

export interface Run {
  readonly previous?: SchoolImport.ImportResult;
  readonly nightly?: boolean;
  readonly now?: DateTime.Utc;
  readonly reversed?: boolean;
}

/** The naive import over today to four weeks ahead, as the nightly run unless told otherwise. */
export const naive = Effect.fn("ImportTesting.naive")(function* (
  corpus: Corpus.Corpus,
  options: Run = {},
) {
  const now = options.now ?? morning;

  const { client, log } = yield* RecordedWebUntis.make(corpus.reads, {
    asOf: now,
    captured: corpus.manifest.ranges,
    reversed: options.reversed ?? false,
  });

  const result = yield* SchoolImport.Service.use((service) =>
    service.run({
      profile: TinySchool.profile,
      now,
      window: { start: today, end: CivilTime.addDays(today, 27) },
      previous: Option.fromUndefinedOr(options.previous),
      nightly: options.nightly ?? true,
    }),
  ).pipe(
    Effect.provide(NaiveImport.layer.pipe(Layer.provide(Layer.succeed(WebUntisClient)(client)))),
  );

  return { result, log: yield* log };
});

/**
 * Runs `effect` on the live clock moved to `at`, so it sees the invented school's dates and still
 * sleeps in real time. A `TestClock` set that far ahead hangs the Postgres test layer.
 */
export const at =
  (instant: DateTime.Utc) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Clock.clockWith((live) => {
      const offset = DateTime.toEpochMillis(instant) - live.currentTimeMillisUnsafe();
      const millis = () => live.currentTimeMillisUnsafe() + offset;
      const nanos = () => live.currentTimeNanosUnsafe() + BigInt(offset) * 1_000_000n;

      const moved: Clock.Clock = {
        currentTimeMillisUnsafe: millis,
        currentTimeMillis: Effect.sync(millis),
        currentTimeNanosUnsafe: nanos,
        currentTimeNanos: Effect.sync(nanos),
        monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
        monotonicTimeNanos: live.monotonicTimeNanos,
        sleep: (duration) => live.sleep(duration),
      };

      return Effect.provideService(effect, Clock.Clock, moved);
    });
