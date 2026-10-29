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
