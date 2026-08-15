import * as Schema from "effect/Schema";
import * as CalendarDate from "../foundation/calendar-date";
import * as NonBlankText from "../foundation/non-blank-text";
import { CourseOfferingId, PersonId } from "../organization/identity";
import {
  BellPeriodId,
  LessonOccurrenceId,
  RecurringMeetingId,
  ScheduleExceptionId,
} from "./identity";
import * as LocalTimeRange from "./local-time-range";

export const LessonOccurrenceRef = Schema.Struct({
  meetingId: RecurringMeetingId,
  scheduledDate: CalendarDate.Schema,
});
export interface LessonOccurrenceRef extends Schema.Schema.Type<typeof LessonOccurrenceRef> {}

export const ScheduleException = Schema.TaggedUnion({
  Cancelled: { id: ScheduleExceptionId, target: LessonOccurrenceRef },
  Rescheduled: {
    id: ScheduleExceptionId,
    target: LessonOccurrenceRef,
    date: CalendarDate.Schema,
    timeRange: LocalTimeRange.Schema,
  },
  RoomChanged: { id: ScheduleExceptionId, target: LessonOccurrenceRef, room: NonBlankText.Schema },
  TeacherChanged: {
    id: ScheduleExceptionId,
    target: LessonOccurrenceRef,
    teacherIds: Schema.NonEmptyArray(PersonId),
  },
});
export type ScheduleException = typeof ScheduleException.Type;

export const LessonOccurrence = Schema.Struct({
  id: LessonOccurrenceId,
  meetingId: RecurringMeetingId,
  courseOfferingId: CourseOfferingId,
  scheduledDate: CalendarDate.Schema,
  date: CalendarDate.Schema,
  timeRange: LocalTimeRange.Schema,
  bellPeriodId: Schema.optionalKey(BellPeriodId),
  room: Schema.optionalKey(NonBlankText.Schema),
  teacherIds: Schema.Array(PersonId),
  appliedExceptionIds: Schema.Array(ScheduleExceptionId),
});
export interface LessonOccurrence extends Schema.Schema.Type<typeof LessonOccurrence> {}

export class UnresolvedScheduleExceptionError extends Schema.TaggedError<UnresolvedScheduleExceptionError>()(
  "Schedule.UnresolvedException",
  {
    exceptionId: ScheduleExceptionId,
    target: LessonOccurrenceRef,
    reason: Schema.Literals([
      "MeetingNotFound",
      "OccurrenceNotScheduled",
      "DestinationNotSchoolDay",
    ]),
  },
) {}

export class ConflictingScheduleExceptionsError extends Schema.TaggedError<ConflictingScheduleExceptionsError>()(
  "Schedule.ConflictingExceptions",
  { target: LessonOccurrenceRef, exceptionIds: Schema.NonEmptyArray(ScheduleExceptionId) },
) {}

export class InvalidScheduleInputError extends Schema.TaggedError<InvalidScheduleInputError>()(
  "Schedule.InvalidInput",
  {
    reason: Schema.Literals(["DuplicateMeetingId", "DuplicateExceptionId"]),
    id: Schema.String.check(Schema.isMinLength(1)),
  },
) {}

export const ScheduleMaterializationError = Schema.Union([
  UnresolvedScheduleExceptionError,
  ConflictingScheduleExceptionsError,
  InvalidScheduleInputError,
]);
export type ScheduleMaterializationError = typeof ScheduleMaterializationError.Type;
