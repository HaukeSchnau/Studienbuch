import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { CalendarDate } from "../foundation/calendar-date";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { NonBlankText } from "../foundation/non-blank-text";
import { AcademicTerm } from "../organization/academic-term";
import { SchoolId } from "../organization/identity";
import { Weekday } from "./weekday";

export const CalendarClosure = Schema.Struct({
  name: NonBlankText.Schema,
  interval: CalendarDateRange.Schema,
});
export interface CalendarClosure extends Schema.Schema.Type<typeof CalendarClosure> {}

export const AcademicCalendar = Schema.Struct({
  schoolId: SchoolId,
  schoolDays: Schema.NonEmptyArray(Weekday.Schema),
  terms: Schema.Array(AcademicTerm),
  closures: Schema.Array(CalendarClosure),
}).check(
  Schema.makeFilter(
    ({ schoolId, terms }) =>
      terms.every((term) => term.schoolId === schoolId) &&
      terms.every((term, index) =>
        terms
          .slice(index + 1)
          .every((other) => !CalendarDateRange.overlaps(term.interval, other.interval)),
      ),
    { expected: "a calendar containing only non-overlapping terms from its school" },
  ),
);
export interface AcademicCalendar extends Schema.Schema.Type<typeof AcademicCalendar> {}

export const academicTermOn = (
  calendar: AcademicCalendar,
  date: CalendarDate.Type,
): Option.Option<AcademicTerm> =>
  Option.fromUndefinedOr(
    calendar.terms.find((term) => CalendarDateRange.contains(term.interval, date)),
  );

export const isSchoolDay = (calendar: AcademicCalendar, date: CalendarDate.Type): boolean =>
  Option.isSome(academicTermOn(calendar, date)) &&
  calendar.schoolDays.some((weekday) => weekday === CalendarDate.dayOfWeek(date)) &&
  !calendar.closures.some((closure) => CalendarDateRange.contains(closure.interval, date));

/** Returns the first school day strictly after `date`. */
export const nextSchoolDay = (
  calendar: AcademicCalendar,
  date: CalendarDate.Type,
): Option.Option<CalendarDate.Type> => {
  const latestTermEnd = calendar.terms.reduce<CalendarDate.Type | undefined>(
    (latest, term) =>
      latest === undefined || CalendarDate.compare(latest, term.interval.end) < 0
        ? term.interval.end
        : latest,
    undefined,
  );
  if (latestTermEnd === undefined || CalendarDate.compare(date, latestTermEnd) >= 0) {
    return Option.none();
  }

  let candidate = CalendarDate.unsafeAddDays(date, 1);
  while (CalendarDate.compare(candidate, latestTermEnd) <= 0) {
    if (isSchoolDay(calendar, candidate)) return Option.some(candidate);
    candidate = CalendarDate.unsafeAddDays(candidate, 1);
  }
  return Option.none();
};
