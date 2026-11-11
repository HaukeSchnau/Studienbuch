/** A civil date in German words, as headings and due dates show it. */
import type { CivilTime } from "@stu/core";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";

export * as DateText from "./DateText.ts";

// ISO weekdays, Monday first.
const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const shortWeekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const months = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** "Montag" */
export const weekday = (date: CivilTime.PlainDate): string =>
  weekdays[PlainDateFns.dayOfWeek(date) - 1] ?? "";

/** "Mo" */
export const shortWeekday = (date: CivilTime.PlainDate): string =>
  shortWeekdays[PlainDateFns.dayOfWeek(date) - 1] ?? "";

/** "Mittwoch, 11. November", as the Übersicht says today. */
export const long = (date: CivilTime.PlainDate): string =>
  `${weekday(date)}, ${String(date.day)}. ${months[date.month - 1] ?? ""}`;
