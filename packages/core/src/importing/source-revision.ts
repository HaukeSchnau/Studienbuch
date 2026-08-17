import * as Equivalence_ from "effect/Equivalence";
import * as Effect from "effect/Effect";
import * as Order_ from "effect/Order";
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
    ? Effect.fail(new Exhausted({ revision }))
    : Effect.succeed(Schema.make(revision + 1));

export const compare = (left: Type, right: Type): -1 | 0 | 1 =>
  left < right ? -1 : left > right ? 1 : 0;

export const Equivalence = Equivalence_.make<Type>((left, right) => compare(left, right) === 0);

export const Order = Order_.make<Type>(compare);

export * as SourceRevision from "./source-revision";
