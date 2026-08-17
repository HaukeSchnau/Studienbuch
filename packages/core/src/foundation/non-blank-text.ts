import * as Schema_ from "effect/Schema";

/** User-facing text that is already trimmed and contains at least one character. */
export type Type = `${string}${string & {}}`;

const isNonEmptyString = Schema_.is(Schema_.NonEmptyString);

const Declared = Schema_.declare<Type>((input): input is Type => isNonEmptyString(input), {
  identifier: "NonBlankText",
});

/**
 * Accepts non-empty literals directly while retaining trimmed, non-empty validation at runtime.
 * Dynamic strings must cross this schema boundary before they enter the domain model.
 */
export const Schema = Schema_.String.check(Schema_.isTrimmed(), Schema_.isNonEmpty()).pipe(
  Schema_.decodeTo(Declared),
);

/** Validates text without throwing and discards mismatch details. */
export const fromString = Schema_.decodeOption(Schema);

/** Validates trusted text and throws when it is blank or not trimmed. */
export const unsafeFromString = Schema_.decodeSync(Schema);

export * as NonBlankText from "./non-blank-text";
