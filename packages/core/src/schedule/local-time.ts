import * as Order_ from "effect/Order";
import type { Ordering } from "effect/Ordering";
import * as Schema_ from "effect/Schema";

const millisecondsPerSecond = 1_000;
const millisecondsPerMinute = 60 * millisecondsPerSecond;
const millisecondsPerHour = 60 * millisecondsPerMinute;
const lastMillisecondOfDay = 24 * millisecondsPerHour - 1;

/**
 * A wall-clock time within one local calendar day, with millisecond precision.
 *
 * This value has no date, timezone, or UTC offset. Its encoded representation is
 * the number of milliseconds since 00:00:00.000. Because 24:00 belongs to the
 * following day, the largest valid value is 23:59:59.999.
 */
export const Schema = Schema_.Int.check(
  Schema_.isBetween({ minimum: 0, maximum: lastMillisecondOfDay }),
).pipe(Schema_.brand("LocalTime"));

export type Type = typeof Schema.Type;

export const toMilliseconds = (time: Type): number => time;

export const hour = (time: Type): number => Math.floor(time / millisecondsPerHour);

export const minute = (time: Type): number =>
  Math.floor((time % millisecondsPerHour) / millisecondsPerMinute);

export const second = (time: Type): number =>
  Math.floor((time % millisecondsPerMinute) / millisecondsPerSecond);

export const millisecond = (time: Type): number => time % millisecondsPerSecond;

/** Formats the canonical, fixed-width representation `HH:mm:ss.SSS`. */
export const toString = (time: Type): string =>
  `${String(hour(time)).padStart(2, "0")}:${String(minute(time)).padStart(2, "0")}:${String(second(time)).padStart(2, "0")}.${String(millisecond(time)).padStart(3, "0")}`;

/**
 * Numeric ordering, named for the domain so a comparison reads as one.
 *
 * `Equivalence` and `Order` are deliberately absent: this is a branded `number`, so equality is
 * `===` and `Order.Number` is already the order. Effect defines its own only for values like
 * `Duration` that have more than one representation.
 */
export const compare: (left: Type, right: Type) => Ordering = Order_.Number;

export * as LocalTime from "./local-time";
