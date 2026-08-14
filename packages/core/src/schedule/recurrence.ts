import { containsDate, isoWeek, type CalendarDate, weekdayOf } from "../primitives";
import type { RecurringMeeting, RotationPattern } from "./model";

export const rotationIncludesDate = (rotation: RotationPattern, date: CalendarDate): boolean =>
  rotation._tag === "EveryWeek" ||
  (rotation._tag === "OddIsoWeek" ? isoWeek(date) % 2 === 1 : isoWeek(date) % 2 === 0);

export const meetingOccursOn = (meeting: RecurringMeeting, date: CalendarDate): boolean =>
  containsDate(meeting.effectiveInterval, date) &&
  meeting.weekday === weekdayOf(date) &&
  rotationIncludesDate(meeting.rotation, date);

export const rotationsCanCoincide = (left: RotationPattern, right: RotationPattern): boolean =>
  left._tag === "EveryWeek" || right._tag === "EveryWeek" || left._tag === right._tag;
