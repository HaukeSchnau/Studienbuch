/**
 * The simulation as the gate for engine changes, on PGlite and PostgreSQL 18. Every run checks a
 * fixed number of workloads from a fixed seed. The nightly run raises `SIMULATION_RUNS` and
 * changes `SIMULATION_SEED`. A failure prints its `SIMULATION_REPLAY` token and its trace.
 */
import { PgClient } from "@effect/sql-pg";
import { PgliteClient } from "@effect/sql-pglite";
import { describe, expect, layer } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as SqlClient from "effect/sql/SqlClient";
import { Listener } from "../server/Listener.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
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
    Simulation.ForgeChoice.make({ device: "a" }),
    Simulation.Choose.make({ device: "a", courses: ["course-bio"] }),
    Simulation.Fault.make({ device: "a", fault: "dropNextResponse" }),
    Simulation.Latency.make({ device: "c", millis: 300 }),
    Simulation.Fault.make({ device: "c", fault: "duplicateNextPush" }),
    Simulation.Choose.make({ device: "c", courses: ["course-de"] }),
    Simulation.Sync.make({ device: "a" }),
    Simulation.Sync.make({ device: "c" }),
    Simulation.Offer.make({ course: "course-ma", offered: false }),
    Simulation.OfferDuringPulls.make({ course: "course-bio", offered: false }),
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

const settings = Config.all({
  runs: Config.Int("SIMULATION_RUNS").pipe(Config.withDefault(40)),
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
  // answer close behind, which most workloads give them.
  expect(faults.dropNextResponse.fired).toBe(faults.dropNextResponse.armed);

  for (const kind of Simulation.Counted.literals) {
    expect(faults[kind].fired, kind).toBeGreaterThan(0);
  }
});

describe("Simulation", () => {
  const pglite = Layer.provideMerge(
    Listener.layer(PgliteClient.PgliteClient, (payload) => payload),
    PgliteClient.layer({}),
  );

  layer(pglite)("on PGlite", (it) => {
    it.effect("the tour runs the same way every time and keeps every invariant", () =>
      Effect.gen(function* () {
        const first = yield* Simulation.run(tour);
        const second = yield* Simulation.run(tour);

        expect(first.violations).toStrictEqual([]);
        expect(second.trace).toStrictEqual(first.trace);
        expect(second.frames).toStrictEqual(first.frames);
        expect(second.lines).toStrictEqual(first.lines);
      }),
    );

    it.effect("random workloads keep every invariant", () => random, randomTimeout);
  });

  describe.skipIf(Postgres18.socket === null)("on PostgreSQL 18", () => {
    const postgres = Layer.provideMerge(
      Listener.layer(PgClient.PgClient, (notification) => notification.payload),
      Postgres18.database(Postgres18.socket ?? ""),
    );

    layer(postgres)("", (it) => {
      it.effect("the tour keeps every invariant", () =>
        Effect.gen(function* () {
          expect((yield* Simulation.run(tour)).violations).toStrictEqual([]);
        }),
      );

      it.effect("random workloads keep every invariant", () => random, randomTimeout);
    });
  });
});
