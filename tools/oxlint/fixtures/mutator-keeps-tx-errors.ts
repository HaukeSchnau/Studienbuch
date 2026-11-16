import { Sync } from "@stu/sync";
import * as Effect from "effect/Effect";

const write = Effect.void;

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
    // A failure that goes through is the mutator's to raise.
    yield* Effect.tapError(write, () => Effect.void);
  }),
});

// Outside a mutator's run, as in the engine or a test's key helper, handling errors is fine.
export const seed = Effect.orDie(write);
