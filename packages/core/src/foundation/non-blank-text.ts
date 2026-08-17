import * as Schema_ from "effect/Schema";

/** User- or provider-authored text with at least one non-whitespace character. */
export type Type = `${string}${string & {}}`;

const isNonEmptyString = Schema_.is(Schema_.NonEmptyString);

const Declared = Schema_.declare<Type>((input): input is Type => isNonEmptyString(input), {
  identifier: "NonBlankText",
});

/**
 * Accepts non-empty literals directly while retaining non-blank validation at runtime.
 * Author-provided spacing is intentionally preserved.
 * Dynamic strings must cross this schema boundary before they enter the domain model.
 */
export const Schema = Schema_.String.check(
  Schema_.makeFilter((value) => value.trim().length > 0, {
    expected: "text containing at least one non-whitespace character",
  }),
).pipe(Schema_.decodeTo(Declared));

export * as NonBlankText from "./non-blank-text";
