/** Dates in German words, as the screens write them: "Mittwoch", "Mi", "Mittwoch, 11. November". */
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

/** "Mittwoch" */
export const weekday = (date: CivilTime.PlainDate) =>
  weekdays[PlainDateFns.dayOfWeek(date) - 1] ?? "";

/** "Mi" */
export const shortWeekday = (date: CivilTime.PlainDate) =>
  shortWeekdays[PlainDateFns.dayOfWeek(date) - 1] ?? "";

/** "Mittwoch, 11. November", as the Übersicht's hero names today. */
export const long = (date: CivilTime.PlainDate) =>
  `${weekday(date)}, ${String(date.day)}. ${months[date.month - 1] ?? ""}`;
