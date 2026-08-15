import * as Schema from "effect/Schema";
import {
  BellPeriodId,
  CalendarDate,
  CourseOfferingId,
  LessonOccurrenceId,
  NonEmptyText,
  PersonId,
  RecurringMeetingId,
  ScheduleExceptionId,
  TimeRange,
} from "../foundation";

export const LessonOccurrenceRef = Schema.Struct({
  meetingId: RecurringMeetingId,
  scheduledDate: CalendarDate,
});
export interface LessonOccurrenceRef extends Schema.Schema.Type<typeof LessonOccurrenceRef> {}

export const ScheduleException = Schema.TaggedUnion({
  Cancelled: { id: ScheduleExceptionId, target: LessonOccurrenceRef },
  Rescheduled: {
    id: ScheduleExceptionId,
    target: LessonOccurrenceRef,
    date: CalendarDate,
    timeRange: TimeRange,
  },
  RoomChanged: { id: ScheduleExceptionId, target: LessonOccurrenceRef, room: NonEmptyText },
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
  scheduledDate: CalendarDate,
  date: CalendarDate,
  timeRange: TimeRange,
  bellPeriodId: Schema.optionalKey(BellPeriodId),
  room: Schema.optionalKey(NonEmptyText),
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
