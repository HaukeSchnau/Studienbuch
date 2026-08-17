import * as Schema_ from "effect/Schema";

/** User-facing text that is already trimmed and contains at least one character. */
export const Schema = Schema_.String.check(Schema_.isTrimmed(), Schema_.isNonEmpty()).pipe(
  Schema_.brand("NonBlankText"),
);

export type Type = typeof Schema.Type;

/** Validates text without throwing and discards mismatch details. */
export const fromString = Schema_.decodeOption(Schema);

/** Validates trusted text and throws when it is blank or not trimmed. */
export const unsafeFromString = Schema_.decodeSync(Schema);

export * as NonBlankText from "./non-blank-text";
