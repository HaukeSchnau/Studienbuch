/**
 * When homework is due, in words, relative to today: "Bis morgen", "Bis Freitag", "Überfällig seit
 * Montag", "Erledigt am Dienstag" (m1-screens.md). Overdue follows core's `HomeworkDates.isOverdue`.
 */
import { HomeworkDates, type CivilTime } from "@stu/core";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

export * as Due from "./Due.ts";

// ISO weekdays, Monday first.
const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const shortWeekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const weekday = (date: CivilTime.PlainDate) => weekdays[PlainDateFns.dayOfWeek(date) - 1] ?? "";

/** "9.11.", or "9.11.2027" in another year than today's. */
const dayMonth = (date: CivilTime.PlainDate, today: CivilTime.PlainDate) =>
  `${String(date.day)}.${String(date.month)}.${date.year === today.year ? "" : String(date.year)}`;

/** "Mo, 9.11." */
const short = (date: CivilTime.PlainDate, today: CivilTime.PlainDate) =>
  `${shortWeekdays[PlainDateFns.dayOfWeek(date) - 1] ?? ""}, ${dayMonth(date, today)}`;

const done = (doneOn: CivilTime.PlainDate, today: CivilTime.PlainDate) => {
  const ago = PlainDateFns.diffDays(doneOn, today);

  return ago <= 0
    ? "Heute erledigt"
    : ago === 1
      ? "Gestern erledigt"
      : `Erledigt am ${ago < 7 ? weekday(doneOn) : dayMonth(doneOn, today)}`;
};

/** The due date as the list and the panel show it. */
export const label = (homework: HomeworkDates.Listed, today: CivilTime.PlainDate): string => {
  if (homework.doneOn !== undefined) return done(homework.doneOn, today);

  const days = PlainDateFns.diffDays(today, homework.dueOn);

  if (HomeworkDates.isOverdue(homework, today)) {
    if (days === -1) return "Überfällig seit gestern";

    return `Überfällig seit ${days > -7 ? weekday(homework.dueOn) : dayMonth(homework.dueOn, today)}`;
  }

  return days === 0
    ? "Heute fällig"
    : days === 1
      ? "Bis morgen"
      : `Bis ${days < 7 ? weekday(homework.dueOn) : short(homework.dueOn, today)}`;
};
