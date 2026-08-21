import * as Schema_ from "effect/Schema";

/** User- or provider-authored text with at least one non-whitespace character. */
export type Type = `${string}${string & {}}`;

/**
 * The one predicate. It guards both the encoded side and the declared side, because a schema whose
 * `decode` rejects a value its `make` accepts is not a validated type: every aggregate in this
 * package is built with `make`, so a weaker guard there is the guard that matters.
 */
const nonBlank = Schema_.String.check(
  Schema_.makeFilter((value) => value.trim().length > 0, {
    expected: "text containing at least one non-whitespace character",
  }),
);

const isNonBlank = Schema_.is(nonBlank);

const Declared = Schema_.declare<Type>((input): input is Type => isNonBlank(input), {
  identifier: "NonBlankText",
});

/**
 * Accepts non-empty literals directly while retaining non-blank validation at runtime.
 * Author-provided spacing is intentionally preserved.
 * Dynamic strings must cross this schema boundary before they enter the domain model.
 */
export const Schema = nonBlank.pipe(Schema_.decodeTo(Declared));

export * as NonBlankText from "./non-blank-text";
