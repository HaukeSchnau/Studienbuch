/**
 * The simulation as the gate for engine changes. Every run checks a fixed number of workloads
 * from a fixed seed, so a run on a pull request and its replay agree. The nightly run raises
 * `SIMULATION_RUNS` and changes `SIMULATION_SEED`. A failure prints the shrunk workload, its replay
 * token and its trace.
 */
import { PgClient } from "@effect/sql-pg";
import { PgliteClient } from "@effect/sql-pglite";
import { describe, expect, layer } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as SqlClient from "effect/sql/SqlClient";
import { Listener } from "../server/Listener.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Simulation } from "./Simulation.ts";

/** Every kind of step at least once, in an order where most of them do something. */
const tour: Simulation.Workload = {
  seed: 7,
  steps: [
    Simulation.Choose.make({ device: "a", courses: ["course-ma"] }),
    Simulation.Add.make({ device: "a", course: "course-ma" }),
    Simulation.Rename.make({ device: "a", pick: 0 }),
    Simulation.Toggle.make({ device: "a", pick: 1, done: true }),
    Simulation.Remove.make({ device: "b", pick: 0 }),
    Simulation.Crash.make({ device: "a" }),
    Simulation.Sync.make({ device: "a" }),
    Simulation.Offline.make({ device: "b", offline: true }),
    Simulation.CrashDuringChoose.make({ device: "b", courses: ["course-de"], after: 3 }),
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
    Simulation.Fault.make({ device: "b", fault: "reorderNext" }),
    Simulation.Sever.make({ device: "b" }),
    Simulation.CrashDuringSync.make({ device: "b", after: 20 }),
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
});

/** What a failed check prints: why it failed, the shrunk workload's trace and violations. */
const explain = (result: Arbitrary.CheckResult<Simulation.Workload, never>) =>
  Effect.gen(function* () {
    const failure = Arbitrary.formatCheckFailure(result);

    if (failure === undefined || result._tag !== "Falsified") return failure;
    const again = yield* Simulation.run(result.shrunkInput);

    return [
      failure,
      ...again.trace,
      ...again.violations.map(
        (violation) =>
          `step ${violation.step}: ${violation.invariant} at ${violation.place}: ${violation.detail}`,
      ),
    ].join("\n");
  });

const random = Effect.gen(function* () {
  const { runs, seed } = yield* settings;
  // What every workload armed and fired, so a generator that stops reaching faults fails.
  const faults = Simulation.noFaults();

  const result = yield* Arbitrary.checkEffect<
    Simulation.Workload,
    never,
    SqlClient.SqlClient | Listener.Service
  >(
    Arbitrary.schema(Simulation.Generated),
    (workload) =>
      Effect.map(Simulation.run(workload), (result) => {
        for (const kind of Simulation.Counted.literals) {
          faults[kind].armed += result.faults[kind].armed;
          faults[kind].fired += result.faults[kind].fired;
        }

        return result.violations.length === 0;
      }),
    { runs, seed },
  );

  return { failure: yield* explain(result), faults };
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
      }),
    );

    it.effect("random workloads keep every invariant", () =>
      Effect.gen(function* () {
        const { failure, faults } = yield* random;

        expect(failure).toBeUndefined();
        // A healed device answers again, so every armed drop fires. The others need a push or a
        // second answer close behind, which most workloads give them.
        expect(faults.dropNextResponse.fired).toBe(faults.dropNextResponse.armed);

        for (const kind of Simulation.Counted.literals) {
          expect(faults[kind].fired, kind).toBeGreaterThan(0);
        }
      }),
    );
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
    });
  });
});
