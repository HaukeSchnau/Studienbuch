import * as Equivalence_ from "effect/Equivalence";
import * as Effect from "effect/Effect";
import * as Order_ from "effect/Order";
import * as Schema_ from "effect/Schema";

/** Monotonic version used for optimistic concurrency on an aggregate. */
export const Schema = Schema_.Natural.pipe(Schema_.brand("AggregateRevision"));

export type Type = typeof Schema.Type;

export const initial: Type = Schema.make(0);

export class Exhausted extends Schema_.TaggedError<Exhausted>()("AggregateRevision.Exhausted", {
  revision: Schema,
}) {}

/** Advances a revision or reports that the finite wire representation is exhausted. */
export const next = (revision: Type): Effect.Effect<Type, Exhausted> =>
  revision === Number.MAX_SAFE_INTEGER
    ? Effect.fail(Exhausted.make({ revision }))
    : Effect.succeed(Schema.make(revision + 1));

export const compare = (left: Type, right: Type): -1 | 0 | 1 =>
  left < right ? -1 : left > right ? 1 : 0;

export const Equivalence = Equivalence_.make<Type>((left, right) => compare(left, right) === 0);

export const Order = Order_.make<Type>(compare);

export * as AggregateRevision from "./aggregate-revision";
