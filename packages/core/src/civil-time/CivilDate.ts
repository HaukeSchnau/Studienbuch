/**
 * Arithmetic on CivilTime's dates without its schemas, which `CivilTime` exposes as well. Bundles
 * that must not load Effect Schema, such as the landing page, reach it through `HomeworkDates`.
 */
import * as Order from "effect/Order";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";
import type { CivilTime } from "./CivilTime.ts";

export * as CivilDate from "./CivilDate.ts";

/** Earlier dates first. */
export const order: Order.Order<CivilTime.PlainDate> = Order.make((self, that) => {
  const sign = PlainDateFns.compare(self, that);

  return sign < 0 ? -1 : sign > 0 ? 1 : 0;
});

export const addDays = (date: CivilTime.PlainDate, days: number): CivilTime.PlainDate =>
  PlainDateFns.addDays(date, days);

/** 1 for Monday to 7 for Sunday. */
export const dayOfWeek = (date: CivilTime.PlainDate): number => PlainDateFns.dayOfWeek(date);

/**
 * The ISO 8601 week, such as `2026-W53` for 31 December 2026. Its year is the week's, which
 * differs from the date's around New Year, where legacy counted 1 January 2027 as week 0.
 */
export const isoWeek = (date: CivilTime.PlainDate): string =>
  `${PlainDateFns.yearOfWeek(date)}-W${String(PlainDateFns.weekOfYear(date)).padStart(2, "0")}`;
