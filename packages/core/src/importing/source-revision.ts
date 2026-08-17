import * as Equivalence_ from "effect/Equivalence";
import * as Option from "effect/Option";
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

/** Advances a source revision, returning None when the safe-integer range is exhausted. */
export const next = (revision: Type): Option.Option<Type> => Schema.makeOption(revision + 1);

/** Advances a trusted source revision and throws when the safe-integer range is exhausted. */
export const unsafeNext = (revision: Type): Type =>
  Option.getOrThrowWith(next(revision), () => new RangeError("SourceRevision is exhausted"));

export const compare = (left: Type, right: Type): -1 | 0 | 1 =>
  left < right ? -1 : left > right ? 1 : 0;

export const Equivalence = Equivalence_.make<Type>((left, right) => compare(left, right) === 0);

export const Order = Order_.make<Type>(compare);

export * as SourceRevision from "./source-revision";
