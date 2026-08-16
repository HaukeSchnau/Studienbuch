import * as Schema from "effect/Schema";
import { CalendarDate } from "../foundation/calendar-date";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { NonBlankText } from "../foundation/non-blank-text";
import { CourseOfferingId, PersonId } from "../organization/identity";
import { BellPeriodId, RecurringMeetingId } from "./identity";
import { LocalTimeRange } from "./local-time-range";
import { Weekday } from "./weekday";

export const RotationPattern = Schema.TaggedUnion({
  EveryWeek: {},
  OddIsoWeek: {},
  EvenIsoWeek: {},
});
export type RotationPattern = typeof RotationPattern.Type;

export const RecurringMeeting = Schema.Struct({
  id: RecurringMeetingId,
  courseOfferingId: CourseOfferingId,
  weekday: Weekday.Schema,
  timeRange: LocalTimeRange.Schema,
  rotation: RotationPattern,
  effectiveInterval: CalendarDateRange.Schema,
  bellPeriodId: Schema.optionalKey(BellPeriodId),
  room: Schema.optionalKey(NonBlankText.Schema),
  teacherIds: Schema.Array(PersonId),
});
export interface RecurringMeeting extends Schema.Schema.Type<typeof RecurringMeeting> {}

const isoWeekIdentity = (date: CalendarDate.Type) => ({
  year: CalendarDate.yearOfWeek(date),
  week: CalendarDate.weekOfYear(date),
});

export const rotationIncludesDate = (
  rotation: RotationPattern,
  date: CalendarDate.Type,
): boolean => {
  if (rotation._tag === "EveryWeek") return true;
  const identity = isoWeekIdentity(date);
  return rotation._tag === "OddIsoWeek" ? identity.week % 2 === 1 : identity.week % 2 === 0;
};

export const meetingOccursOn = (meeting: RecurringMeeting, date: CalendarDate.Type): boolean =>
  CalendarDateRange.contains(meeting.effectiveInterval, date) &&
  meeting.weekday === CalendarDate.dayOfWeek(date) &&
  rotationIncludesDate(meeting.rotation, date);

export const rotationsCanCoincide = (left: RotationPattern, right: RotationPattern): boolean =>
  left._tag === "EveryWeek" || right._tag === "EveryWeek" || left._tag === right._tag;
