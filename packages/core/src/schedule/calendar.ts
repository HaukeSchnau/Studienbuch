import * as Option from "effect/Option";
import { addCalendarDays, containsDate, type CalendarDate, weekdayOf } from "../primitives";
import type { AcademicCalendar, AcademicTerm } from "./model";

export const academicTermOn = (
  calendar: AcademicCalendar,
  date: CalendarDate,
): Option.Option<AcademicTerm> =>
  Option.fromUndefinedOr(
    [...calendar.terms]
      .sort((left, right) => left.interval.start.localeCompare(right.interval.start))
      .find((term) => term.schoolId === calendar.schoolId && containsDate(term.interval, date)),
  );

export const isSchoolDay = (calendar: AcademicCalendar, date: CalendarDate): boolean =>
  Option.isSome(academicTermOn(calendar, date)) &&
  calendar.schoolDays.includes(weekdayOf(date)) &&
  !calendar.closures.some((closure) => containsDate(closure.interval, date));

/** Returns the first school day strictly after `date`. */
export const nextSchoolDay = (
  calendar: AcademicCalendar,
  date: CalendarDate,
): Option.Option<CalendarDate> => {
  const latestTermEnd = calendar.terms.reduce<CalendarDate | undefined>(
    (latest, term) =>
      latest === undefined || latest < term.interval.end ? term.interval.end : latest,
    undefined,
  );
  if (latestTermEnd === undefined || date >= latestTermEnd) return Option.none();

  let candidate = addCalendarDays(date, 1);
  while (candidate <= latestTermEnd) {
    if (isSchoolDay(calendar, candidate)) return Option.some(candidate);
    candidate = addCalendarDays(candidate, 1);
  }
  return Option.none();
};
