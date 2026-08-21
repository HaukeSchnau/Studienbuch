import * as Effect from "effect/Effect";
import * as Equivalence_ from "effect/Equivalence";
import * as Order_ from "effect/Order";
import * as Schema_ from "effect/Schema";

/** Monotonic version used for optimistic concurrency on an aggregate. */
export const Schema = Schema_.Natural.pipe(Schema_.brand("AggregateRevision"));

export type Type = typeof Schema.Type;

export const initial: Type = Schema.make(0);

/**
 * Names the aggregate a failure is about. Diagnostic only: every aggregate recovers from a
 * concurrent revision the same way, by reloading and retrying, so this does not need to be a
 * closed union that `foundation` would have to keep in step with every domain area.
 */
export const AggregateName = Schema_.String.check(Schema_.isTrimmed(), Schema_.isNonEmpty());
export type AggregateName = typeof AggregateName.Type;

export class Exhausted extends Schema_.TaggedError<Exhausted>()("AggregateRevision.Exhausted", {
  revision: Schema,
}) {}

/**
 * Someone else advanced the aggregate between the caller reading it and asking to change it.
 *
 * One error rather than one per aggregate: the condition, the payload and the recovery are
 * identical everywhere, and four names for it only made callers write four `catchTag` arms.
 */
export class Concurrent extends Schema_.TaggedError<Concurrent>()("AggregateRevision.Concurrent", {
  aggregate: AggregateName,
  expected: Schema,
  actual: Schema,
}) {}

/** Advances a revision or reports that the finite wire representation is exhausted. */
export const next = (revision: Type): Effect.Effect<Type, Exhausted> =>
  revision === Number.MAX_SAFE_INTEGER
    ? Effect.fail(Exhausted.make({ revision }))
    : Effect.succeed(Schema.make(revision + 1));

/** The optimistic-concurrency guard every aggregate transition opens with. */
export const ensureCurrent = (
  aggregate: AggregateName,
  actual: Type,
  expected: Type,
): Effect.Effect<void, Concurrent> =>
  actual === expected
    ? Effect.void
    : Effect.fail(Concurrent.make({ aggregate, expected, actual }));

interface Revised {
  readonly revision: Type;
}

/**
 * Produces the next version of an aggregate: applies `changes` and advances `revision`.
 *
 * Every transition used to spell this out itself, three different ways — spread with a
 * `no-misused-spread` suppression, or a field-by-field rebuild. The rebuilds are what silently
 * dropped `withdrawal` from `AbsenceCase`, so carrying every untouched field is this function's
 * job rather than each caller's.
 */
export const revise = <A extends Revised>(
  schema: { readonly make: (fields: A) => A },
  aggregate: A,
  changes: Omit<Partial<A>, "revision">,
): Effect.Effect<A, Exhausted> =>
  Effect.map(next(aggregate.revision), (revision): A =>
    schema.make({ ...aggregate, ...changes, revision }),
  );

export const compare = (left: Type, right: Type): -1 | 0 | 1 =>
  left < right ? -1 : left > right ? 1 : 0;

export const Equivalence = Equivalence_.make<Type>((left, right) => compare(left, right) === 0);

export const Order = Order_.make<Type>(compare);

export * as AggregateRevision from "./aggregate-revision";
