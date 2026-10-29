/**
 * Text that people type. A form decodes its input with these schemas before it calls a mutator,
 * so an invalid value never reaches the outbox and the save button can stay disabled until it
 * decodes.
 */
import * as Schema from "effect/Schema";

export * as Text from "./Text.ts";

/** Text with at least one character that isn't whitespace. Spacing stays as the author typed it. */
export const NonBlank = Schema.String.check(
  Schema.makeFilter((text) => text.trim().length > 0, {
    expected: "text with at least one character that isn't whitespace",
  }),
).pipe(Schema.brand("NonBlankText"));

export type NonBlank = typeof NonBlank.Type;
