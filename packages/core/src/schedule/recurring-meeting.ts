import * as Schema from "effect/Schema";
import {
  BellPeriodId,
  containsDate,
  type CalendarDate,
  CourseOfferingId,
  DateInterval,
  isoWeek,
  NonEmptyText,
  PersonId,
  RecurringMeetingId,
  TimeRange,
  Weekday,
  weekdayOf,
} from "../foundation";

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
  timeRange: TimeRange,
  rotation: RotationPattern,
  effectiveInterval: DateInterval,
  bellPeriodId: Schema.optionalKey(BellPeriodId),
  room: Schema.optionalKey(NonEmptyText),
  teacherIds: Schema.Array(PersonId),
});
export interface RecurringMeeting extends Schema.Schema.Type<typeof RecurringMeeting> {}

export const rotationIncludesDate = (rotation: RotationPattern, date: CalendarDate): boolean =>
  rotation._tag === "EveryWeek" ||
  (rotation._tag === "OddIsoWeek" ? isoWeek(date) % 2 === 1 : isoWeek(date) % 2 === 0);

export const meetingOccursOn = (meeting: RecurringMeeting, date: CalendarDate): boolean =>
  containsDate(meeting.effectiveInterval, date) &&
  meeting.weekday === weekdayOf(date) &&
  rotationIncludesDate(meeting.rotation, date);

export const rotationsCanCoincide = (left: RotationPattern, right: RotationPattern): boolean =>
  left._tag === "EveryWeek" || right._tag === "EveryWeek" || left._tag === right._tag;
