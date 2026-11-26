/**
 * How the corpus's tools report a failure without corpus content: an error whose fields name
 * paths, kinds and counts only prints as it is, any other by its tag alone, because a schema or
 * WebUntis error can quote the body it failed on, and a raw body names students.
 */
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

export * as Sanitized from "./Sanitized.ts";

/** A failure whose details may hold a raw value, reduced to its kind. */
export class Failed extends Schema.TaggedError<Failed, { readonly brand: unique symbol }>()(
  "Corpus.Failed",
  { kind: Schema.String },
) {}

/** Fails with every error but those tagged `safe` reduced to its tag. */
export const only =
  (safe: ReadonlySet<string>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | Failed, R> =>
    Effect.catchCause(effect, (cause) => {
      const error = Cause.squash(cause);

      const tag =
        Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag)
          ? error._tag
          : "a defect";

      return safe.has(tag)
        ? Effect.failCause<E | Failed>(cause)
        : Effect.fail<E | Failed>(new Failed({ kind: tag }));
    });
