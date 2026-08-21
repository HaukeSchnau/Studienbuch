import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
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
  weekday: Weekday,
  timeRange: LocalTimeRange.Schema,
  rotation: RotationPattern,
  effectiveInterval: CalendarDateRange.Schema,
  bellPeriodId: Schema.optional(BellPeriodId),
  room: Schema.optional(NonBlankText),
  teacherIds: Schema.Array(PersonId),
});
export interface RecurringMeeting extends Schema.Schema.Type<typeof RecurringMeeting> {}

export const rotationIncludesDate = (
  rotation: RotationPattern,
  date: PlainDate.Record,
): boolean => {
  if (rotation._tag === "EveryWeek") return true;
  const week = PlainDate.weekOfYear(date);
  return week !== undefined && (rotation._tag === "OddIsoWeek" ? week % 2 === 1 : week % 2 === 0);
};

export const meetingOccursOn = (meeting: RecurringMeeting, date: PlainDate.Record): boolean =>
  CalendarDateRange.contains(meeting.effectiveInterval, date) &&
  meeting.weekday === PlainDate.dayOfWeek(date) &&
  rotationIncludesDate(meeting.rotation, date);

export const rotationsCanCoincide = (left: RotationPattern, right: RotationPattern): boolean =>
  left._tag === "EveryWeek" || right._tag === "EveryWeek" || left._tag === right._tag;
