import * as Schema_ from "effect/Schema";

/** ISO 8601 weekday number: Monday is 1 and Sunday is 7. */
export const Schema = Schema_.Literals([1, 2, 3, 4, 5, 6, 7]);

export type Type = typeof Schema.Type;
