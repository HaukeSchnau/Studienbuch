import * as Schema from "effect/Schema";
import { PlainDateSchema } from "../foundation/plain-date";
import { NonBlankText } from "../foundation/non-blank-text";
import { CourseOfferingId, PersonId } from "../organization/identity";
import {
  BellPeriodId,
  LessonOccurrenceId,
  RecurringMeetingId,
  ScheduleExceptionId,
} from "./identity";
import { LocalTimeRange } from "./local-time-range";

export const LessonOccurrenceRef = Schema.Struct({
  meetingId: RecurringMeetingId,
  scheduledDate: PlainDateSchema,
});
export interface LessonOccurrenceRef extends Schema.Schema.Type<typeof LessonOccurrenceRef> {}

export const ScheduleException = Schema.TaggedUnion({
  Cancelled: { id: ScheduleExceptionId, target: LessonOccurrenceRef },
  Rescheduled: {
    id: ScheduleExceptionId,
    target: LessonOccurrenceRef,
    date: PlainDateSchema,
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
  scheduledDate: PlainDateSchema,
  date: PlainDateSchema,
  timeRange: LocalTimeRange.Schema,
  bellPeriodId: Schema.optionalKey(BellPeriodId),
  room: Schema.optionalKey(NonBlankText.Schema),
  teacherIds: Schema.Array(PersonId),
  appliedExceptionIds: Schema.Array(ScheduleExceptionId),
});
export interface LessonOccurrence extends Schema.Schema.Type<typeof LessonOccurrence> {}

export class UnresolvedException extends Schema.TaggedError<UnresolvedException>()(
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

export class ConflictingExceptions extends Schema.TaggedError<ConflictingExceptions>()(
  "Schedule.ConflictingExceptions",
  { target: LessonOccurrenceRef, exceptionIds: Schema.NonEmptyArray(ScheduleExceptionId) },
) {}

export class InvalidInput extends Schema.TaggedError<InvalidInput>()("Schedule.InvalidInput", {
  reason: Schema.Literals(["DuplicateMeetingId", "DuplicateExceptionId"]),
  id: Schema.String.check(Schema.isMinLength(1)),
}) {}

export const ScheduleMaterializationError = Schema.Union([
  UnresolvedException,
  ConflictingExceptions,
  InvalidInput,
]);
export type ScheduleMaterializationError = typeof ScheduleMaterializationError.Type;
