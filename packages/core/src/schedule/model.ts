import * as Schema from "effect/Schema";
import { AcademicTerm } from "../academics/model";
import {
  BellPeriodId,
  BellScheduleId,
  CalendarDate,
  CourseOfferingId,
  DateInterval,
  LessonOccurrenceId,
  NonEmptyText,
  PersonId,
  RecurringMeetingId,
  ScheduleExceptionId,
  SchoolId,
  TimeRange,
  Weekday,
} from "../primitives";

export { AcademicTerm } from "../academics/model";

export const CalendarClosure = Schema.Struct({
  name: NonEmptyText,
  interval: DateInterval,
});
export interface CalendarClosure extends Schema.Schema.Type<typeof CalendarClosure> {}

export const AcademicCalendar = Schema.Struct({
  schoolId: SchoolId,
  schoolDays: Schema.NonEmptyArray(Weekday),
  terms: Schema.Array(AcademicTerm),
  closures: Schema.Array(CalendarClosure),
}).check(
  Schema.makeFilter(
    ({ schoolId, terms }) =>
      terms.every((term) => term.schoolId === schoolId) &&
      terms.every((term, index) =>
        terms
          .slice(index + 1)
          .every(
            (other) =>
              term.interval.end < other.interval.start || other.interval.end < term.interval.start,
          ),
      ),
    { expected: "a calendar containing only non-overlapping terms from its school" },
  ),
);
export interface AcademicCalendar extends Schema.Schema.Type<typeof AcademicCalendar> {}

export const BellPeriod = Schema.Struct({
  id: BellPeriodId,
  label: NonEmptyText,
  timeRange: TimeRange,
});
export interface BellPeriod extends Schema.Schema.Type<typeof BellPeriod> {}

export const BellSchedule = Schema.Struct({
  id: BellScheduleId,
  schoolId: SchoolId,
  effectiveInterval: DateInterval,
  periods: Schema.Array(BellPeriod),
});
export interface BellSchedule extends Schema.Schema.Type<typeof BellSchedule> {}

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

export const LessonOccurrenceRef = Schema.Struct({
  meetingId: RecurringMeetingId,
  scheduledDate: CalendarDate,
});
export interface LessonOccurrenceRef extends Schema.Schema.Type<typeof LessonOccurrenceRef> {}

export const ScheduleException = Schema.TaggedUnion({
  Cancelled: {
    id: ScheduleExceptionId,
    target: LessonOccurrenceRef,
  },
  Rescheduled: {
    id: ScheduleExceptionId,
    target: LessonOccurrenceRef,
    date: CalendarDate,
    timeRange: TimeRange,
  },
  RoomChanged: {
    id: ScheduleExceptionId,
    target: LessonOccurrenceRef,
    room: NonEmptyText,
  },
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
  {
    target: LessonOccurrenceRef,
    exceptionIds: Schema.NonEmptyArray(ScheduleExceptionId),
  },
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
