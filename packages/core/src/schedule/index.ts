export {
  AcademicCalendar,
  academicTermOn,
  CalendarClosure,
  isSchoolDay,
  nextSchoolDay,
} from "./academic-calendar";
export { BellPeriod, BellSchedule } from "./bell-schedule";
export {
  BellPeriodId,
  BellScheduleId,
  LessonOccurrenceId,
  RecurringMeetingId,
  ScheduleExceptionId,
} from "./identity";
export { LocalTime } from "./local-time";
export { LocalTimeRange } from "./local-time-range";
export { Weekday } from "./weekday";
export {
  findBellPeriodCollisions,
  findLessonOccurrenceCollisions,
  findRecurringMeetingCollisions,
  type BellPeriodCollision,
  type LessonOccurrenceCollision,
  type RecurringMeetingCollision,
} from "./collisions";
export { lessonOccurrenceId, materializeSchoolDay } from "./materialize";
export {
  ConflictingScheduleExceptionsError,
  LessonOccurrence,
  LessonOccurrenceRef,
  InvalidScheduleInputError,
  ScheduleException,
  ScheduleMaterializationError,
  UnresolvedScheduleExceptionError,
} from "./lesson-occurrence";
export {
  meetingOccursOn,
  RecurringMeeting,
  RotationPattern,
  rotationIncludesDate,
  rotationsCanCoincide,
} from "./recurring-meeting";

export * as Schedule from "./index";
