import * as Schema from "effect/Schema";

/**
 * The template literal, rather than a brand, is what lets `title: "Klausur 1"` be written directly:
 * it accepts any non-empty string literal while still rejecting a plain `string`.
 */
type NonBlank = `${string}${string & {}}`;

/**
 * The one predicate. It guards both the encoded side and the declared side, because a schema whose
 * `decode` rejects a value its `make` accepts is not a validated type: every aggregate in this
 * package is built with `make`, so a weaker guard there is the guard that matters.
 */
const nonBlank = Schema.String.check(
  Schema.makeFilter((value) => value.trim().length > 0, {
    expected: "text containing at least one non-whitespace character",
  }),
);

const isNonBlank = Schema.is(nonBlank);

const Declared = Schema.declare<NonBlank>((input): input is NonBlank => isNonBlank(input), {
  identifier: "NonBlankText",
});

/**
 * User- or provider-authored text with at least one non-whitespace character.
 *
 * Author-provided spacing is intentionally preserved. Dynamic strings must cross this schema
 * boundary before they enter the domain model.
 */
export const NonBlankText = nonBlank.pipe(Schema.decodeTo(Declared));
export type NonBlankText = typeof NonBlankText.Type;
