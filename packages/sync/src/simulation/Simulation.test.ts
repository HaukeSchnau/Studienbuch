/**
 * The simulation as the gate for engine changes, on PGlite and PostgreSQL 18. Every run checks a
 * fixed number of workloads from a fixed seed. The nightly run raises `SIMULATION_RUNS` and
 * changes `SIMULATION_SEED`. A failure prints its `SIMULATION_REPLAY` token and its trace.
 */
import { NodeFileSystem } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { PgliteClient } from "@effect/sql-pglite";
import { describe, expect, layer } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as SqlClient from "effect/sql/SqlClient";
import { Listener } from "../server/Listener.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Leaks } from "./Leaks.ts";
import { Recorder } from "./Recorder.ts";
import { Simulation } from "./Simulation.ts";

/** Every kind of step at least once, in an order where most of them do something. */
const tour: Simulation.Workload = {
  seed: 7,
  steps: [
    // A restored phone makes a different command #1 than the one the server applied.
    Simulation.Backup.make({ device: "a" }),
    Simulation.Choose.make({ device: "a", courses: ["course-ma"] }),
    Simulation.Sync.make({ device: "a" }),
    Simulation.Restore.make({ device: "a" }),
    Simulation.Choose.make({ device: "a", courses: ["course-de"] }),
    Simulation.Add.make({ device: "a", course: "course-ma" }),
    Simulation.Rename.make({ device: "a", pick: 0 }),
    Simulation.Toggle.make({ device: "a", pick: 1, done: true }),
    Simulation.Remove.make({ device: "b", pick: 0 }),
    Simulation.Crash.make({ device: "a" }),
    Simulation.Sync.make({ device: "a" }),
    Simulation.Offline.make({ device: "b", offline: true }),
    Simulation.CrashDuringChoose.make({ device: "b", courses: ["course-de"], statement: 6 }),
    Simulation.Offline.make({ device: "b", offline: false }),
    Simulation.CrashBeforeQueue.make({ device: "a", courses: ["course-ma"] }),
    Simulation.ForgeChoice.make({ device: "a" }),
    Simulation.Choose.make({ device: "a", courses: ["course-bio"] }),
    Simulation.Fault.make({ device: "a", fault: "dropNextResponse" }),
    Simulation.Latency.make({ device: "c", millis: 300 }),
    Simulation.Fault.make({ device: "c", fault: "duplicateNextPush" }),
    // The push's answer and the poke for c's own write come back to back.
    Simulation.Fault.make({ device: "c", fault: "reorderNext" }),
    Simulation.Choose.make({ device: "c", courses: ["course-de"] }),
    Simulation.Sync.make({ device: "a" }),
    Simulation.Sync.make({ device: "c" }),
    Simulation.Offer.make({ course: "course-ma", offered: false }),
    Simulation.OfferDuringPulls.make({ course: "course-bio", offered: false }),
    // The second commits new rows while a pull reads, which only its snapshot keeps out.
    Simulation.OfferDuringPulls.make({ course: "course-bio", offered: true }),
    Simulation.Admit.make({ account: "tom", admitted: false }),
    Simulation.Fault.make({ device: "b", fault: "reorderNext" }),
    Simulation.Sever.make({ device: "b" }),
    Simulation.CrashDuringSync.make({ device: "b", statement: 20 }),
    Simulation.Admit.make({ account: "tom", admitted: true }),
    Simulation.ForgeUnreadable.make({ device: "a", unknownMutator: true }),
    Simulation.Choose.make({ device: "a", courses: ["course-de"] }),
    Simulation.ForgeUnreadable.make({ device: "c", unknownMutator: false }),
    Simulation.Choose.make({ device: "c", courses: ["course-bio"] }),
    Simulation.Dismiss.make({ device: "a" }),
    Simulation.Wait.make({ millis: 60_000 }),
  ],
};

/**
 * Small workloads, each the shortest path to one guard, which random workloads reach only now and
 * then.
 */
const cases = {
  "a write reaches a connected, idle device by a poke": {
    seed: 1,
    steps: [
      Simulation.Sync.make({ device: "b" }),
      Simulation.Choose.make({ device: "a", courses: ["course-de"] }),
      Simulation.Sync.make({ device: "a" }),
    ],
  },
  "a student who leaves the school loses it on a device that sat idle": {
    seed: 2,
    steps: [
      Simulation.Choose.make({ device: "a", courses: ["course-de"] }),
      Simulation.Sync.make({ device: "a" }),
      Simulation.Sync.make({ device: "b" }),
      // Long enough for the choice's own poke to have reached b, so only the leave's can bring news.
      Simulation.Wait.make({ millis: 60_000 }),
      Simulation.Admit.make({ account: "lena", admitted: false }),
    ],
  },
  "a refusal comes with the last page of a pull that spans pages": {
    seed: 3,
    steps: [
      Simulation.Offline.make({ device: "a", offline: true }),
      Simulation.ForgeChoice.make({ device: "a" }),
      Simulation.Choose.make({ device: "a", courses: ["course-de"] }),
      Simulation.Offer.make({ course: "course-ma", offered: false }),
      Simulation.Offer.make({ course: "course-de", offered: false }),
      Simulation.Offer.make({ course: "course-bio", offered: false }),
      Simulation.Offline.make({ device: "a", offline: false }),
    ],
  },
} satisfies Record<string, Simulation.Workload>;

const runCases = Effect.gen(function* () {
  for (const [name, workload] of Object.entries(cases)) {
    expect((yield* Simulation.run(workload)).violations, name).toStrictEqual([]);
  }
});

/**
 * No marker in what runs outside every world: the database client and its `LISTEN`, and
 * PostgreSQL 18's own log, where a failed statement's `DETAIL` may quote a value.
 */
const outsideLeaks = Effect.gen(function* () {
  const shared = yield* Recorder.Shared;
  const files = yield* FileSystem.FileSystem;

  const log =
    Postgres18.log === null ? "" : yield* Effect.orDie(files.readFileString(Postgres18.log));

  return [
    ...shared.lines().flatMap((line) => Leaks.find("database client", line, Leaks.stored)),
    ...Leaks.find("postgres log", log, Leaks.stored),
  ];
});

const settings = Config.all({
  runs: Config.Int("SIMULATION_RUNS").pipe(Config.withDefault(10)),
  seed: Config.Int("SIMULATION_SEED").pipe(Config.withDefault(20_261_029)),
  /** The token a failure printed, which runs that failure and its shrinking again. */
  replay: Config.String("SIMULATION_REPLAY").pipe(Config.option),
});

/**
 * A workload takes up to about 3.5 s on a loaded machine, so this fits a nightly run of about 500.
 * Vitest needs it before the test reads `SIMULATION_RUNS`.
 */
const randomTimeout = 1_800_000;

/** What a failed check prints: how to replay it, the shrunk workload's trace and violations. */
const explain = (result: Arbitrary.CheckResult<Simulation.Workload, never>) =>
  Effect.gen(function* () {
    if (result._tag !== "Falsified") return Arbitrary.formatCheckFailure(result);
    const again = yield* Simulation.run(result.shrunkInput);

    return [
      `Falsified after ${result.runs} workloads and ${result.shrinks} shrinks.`,
      `SIMULATION_REPLAY='${result.replay}' runs it again.`,
      `Seed ${result.shrunkInput.seed}. The steps left, and what each did:`,
      ...again.trace,
      ...again.violations.map(
        (violation) =>
          `step ${violation.step}: ${violation.invariant} at ${violation.place}: ${violation.detail}`,
      ),
    ].join("\n");
  });

const random = Effect.gen(function* () {
  const { runs, seed, replay } = yield* settings;
  // What every workload armed and fired, so a generator that stops reaching faults fails.
  const faults = Simulation.noFaults();

  const result = yield* Arbitrary.checkEffect<
    Simulation.Workload,
    never,
    SqlClient.SqlClient | Listener.Service
  >(
    Simulation.arbitrary,
    (workload) =>
      Effect.map(Simulation.run(workload), (result) => {
        for (const kind of Simulation.Counted.literals) {
          faults[kind].armed += result.faults[kind].armed;
          faults[kind].fired += result.faults[kind].fired;
        }

        return result.violations.length === 0;
      }),
    { runs, seed, replay: Option.getOrUndefined(replay) },
  );

  expect(yield* explain(result)).toBeUndefined();

  if (Option.isSome(replay)) return;
  // A healed device answers again, so every armed drop fires. The others need a push or a second
  // answer close behind, which 40 workloads give each kind; the tour fires every kind each run.
  expect(faults.dropNextResponse.fired).toBe(faults.dropNextResponse.armed);

  if (runs < 40) return;

  for (const kind of Simulation.Counted.literals) {
    expect(faults[kind].fired, kind).toBeGreaterThan(0);
  }
});

describe("Simulation", () => {
  const pglite = Recorder.shared(
    Layer.provideMerge(
      Listener.layer(PgliteClient.PgliteClient, (payload) => payload),
      PgliteClient.layer({}),
    ),
  );

  layer(pglite)("on PGlite", (it) => {
    it.effect("the tour runs the same way every time and keeps every invariant", () =>
      Effect.gen(function* () {
        const first = yield* Simulation.run(tour);
        const second = yield* Simulation.run(tour);

        expect(first.violations).toStrictEqual([]);

        for (const kind of Simulation.Counted.literals) {
          expect(first.faults[kind].fired, kind).toBeGreaterThan(0);
        }

        expect(second.trace).toStrictEqual(first.trace);
        expect(second.frames).toStrictEqual(first.frames);
        expect(second.lines).toStrictEqual(first.lines);
      }),
    );

    it.effect("each small case keeps every invariant", () => runCases);

    it.effect("random workloads keep every invariant", () => random, randomTimeout);

    it.effect("nothing outside the worlds saw a marker", () =>
      Effect.gen(function* () {
        expect(yield* outsideLeaks).toStrictEqual([]);
      }).pipe(Effect.provide(NodeFileSystem.layer)),
    );
  });

  describe.skipIf(Postgres18.socket === null)("on PostgreSQL 18", () => {
    const postgres = Recorder.shared(
      Layer.provideMerge(
        Listener.layer(PgClient.PgClient, (notification) => notification.payload),
        Postgres18.database(Postgres18.socket ?? ""),
      ),
    );

    layer(postgres)("", (it) => {
      it.effect("the tour keeps every invariant", () =>
        Effect.gen(function* () {
          expect((yield* Simulation.run(tour)).violations).toStrictEqual([]);
        }),
      );

      it.effect("each small case keeps every invariant", () => runCases);

      it.effect("random workloads keep every invariant", () => random, randomTimeout);

      it.effect("nothing outside the worlds saw a marker", () =>
        Effect.gen(function* () {
          expect(yield* outsideLeaks).toStrictEqual([]);
        }).pipe(Effect.provide(NodeFileSystem.layer)),
      );
    });
  });
});
