import * as Effect from "effect/Effect";
import * as Order_ from "effect/Order";
import type { Ordering } from "effect/Ordering";
import * as Schema_ from "effect/Schema";

/**
 * Importer-normalized monotonic sequence for one source record.
 *
 * Values are comparable only when they describe the same `(DataSourceId, ExternalId)` pair. The
 * importer owns translation from provider-specific versions or cursors into this sequence.
 */
export const Schema = Schema_.Natural.pipe(Schema_.brand("SourceRevision"));

export type Type = typeof Schema.Type;

export const initial: Type = Schema.make(0);

export class Exhausted extends Schema_.TaggedError<Exhausted>()(
  "Importing.SourceRevisionExhausted",
  {
    revision: Schema,
  },
) {}

/** Advances a source revision or reports exhaustion of its finite wire representation. */
export const next = (revision: Type): Effect.Effect<Type, Exhausted> =>
  revision === Number.MAX_SAFE_INTEGER
    ? Effect.fail(Exhausted.make({ revision }))
    : Effect.succeed(Schema.make(revision + 1));

/**
 * Numeric ordering, named for the domain so a comparison reads as one.
 *
 * `Equivalence` and `Order` are deliberately absent: this is a branded `number`, so equality is
 * `===` and `Order.Number` is already the order. Effect defines its own only for values like
 * `Duration` that have more than one representation.
 */
export const compare: (left: Type, right: Type) => Ordering = Order_.Number;

export * as SourceRevision from "./source-revision";
