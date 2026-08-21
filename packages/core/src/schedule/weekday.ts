import * as Schema from "effect/Schema";

/** ISO 8601 weekday number: Monday is 1 and Sunday is 7. */
export const Weekday = Schema.Literals([1, 2, 3, 4, 5, 6, 7]);
export type Weekday = typeof Weekday.Type;
