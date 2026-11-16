import { Sync } from "@stu/sync";
import * as Effect from "effect/Effect";
import type * as ExecutionPlan from "effect/ExecutionPlan";
import * as Schedule from "effect/Schedule";

const write = Effect.void;
declare const plan: ExecutionPlan.ExecutionPlan<never>;

export const rename = Sync.mutator("note.rename", {
  version: 1,
  writes: [],
  spaces: () => [],
  run: Effect.fn("Notes.rename")(function* () {
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: a caught Tx refusal
    yield* write.pipe(Effect.catchTags({ "Tx.RowMissing": () => Effect.void }));
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: an orDie'd write
    yield* Effect.orDie(write);
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: a write's result
    yield* Effect.result(write);
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: failures set aside
    yield* Effect.partition([1], () => write);
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: failures as an array
    yield* Effect.validate([1], () => write);
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: a fallback on failure
    yield* Effect.repeatOrElse(write, Schedule.recurs(1), () => Effect.void);
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: the other side wins
    yield* Effect.race(write, Effect.void);
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: early failures wait
    yield* Effect.raceAll([write, Effect.void]);
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: a retry by plan
    yield* Effect.withExecutionPlan(write, plan);
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: a replaced error
    yield* Effect.unwrapReason(write, "reason");
    // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: failures as values
    yield* Effect.all([write], { mode: "result" });
    // Every failure of an `all` without a mode goes through.
    yield* Effect.all([write]);
    // A failure that goes through is the mutator's to raise.
    yield* Effect.tapError(write, () => Effect.void);
  }),
});

// Outside a mutator's run, as in the engine or a test's key helper, handling errors is fine.
export const seed = Effect.orDie(write);
