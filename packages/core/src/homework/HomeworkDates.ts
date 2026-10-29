/**
 * How homework's dates show: list order, overdue, dimmed, and the due dates the form offers.
 * `Homework` exposes the same rules. This module imports neither Sync nor Effect Schema, so the
 * landing page renders homework without loading the mutators.
 */
import * as Order from "effect/Order";
import { CivilDate } from "../civil-time/CivilDate.ts";
import type { CivilTime } from "../civil-time/CivilTime.ts";

export * as HomeworkDates from "./HomeworkDates.ts";

/** What the display rules read: a row decoded through `Homework.Row.codec`, with its id. */
export interface Listed {
  readonly id: string;
  readonly dueOn: CivilTime.PlainDate;
  readonly doneOn?: CivilTime.PlainDate | undefined;
}

/**
 * Open homework first, then done, each by due date with the earliest first. Ties go by id, so
 * every device shows the same order.
 */
export const order: Order.Order<Listed> = Order.combineAll([
  Order.mapInput(Order.Boolean, (homework: Listed) => homework.doneOn !== undefined),
  Order.mapInput(CivilDate.order, (homework: Listed) => homework.dueOn),
  Order.mapInput(Order.String, (homework: Listed) => homework.id),
]);

/** Open and past its due date, but not on the due date itself. The list shows its date in red. */
export const isOverdue = (homework: Listed, today: CivilTime.PlainDate): boolean =>
  homework.doneOn === undefined && CivilDate.order(homework.dueOn, today) < 0;

/** Done, or open for more than 7 days past its due date. The list greys it out. */
export const isDimmed = (homework: Listed, today: CivilTime.PlainDate): boolean =>
  homework.doneOn !== undefined || CivilDate.order(CivilDate.addDays(homework.dueOn, 7), today) < 0;

/**
 * The due dates the form offers: today to 365 days ahead. No mutator checks them, because a
 * command may run days after the form.
 */
export const dueDates = (today: CivilTime.PlainDate): CivilTime.DateRange => ({
  start: today,
  end: CivilDate.addDays(today, 365),
});
