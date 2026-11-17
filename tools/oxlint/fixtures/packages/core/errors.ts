import * as Effect from "effect/Effect";

// packages/core runs inside mutators, so a helper outside any `run` lets errors through too.
export const requireExisting = Effect.void.pipe(
  // oxlint-disable-next-line studienbuch/mutator-keeps-tx-errors -- fixture: a core helper's catch
  Effect.catchTags({ "Tx.RowMissing": () => Effect.void }),
);
