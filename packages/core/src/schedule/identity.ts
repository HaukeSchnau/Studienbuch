import { entityId } from "../internal/entity-id";

/** Identifies a versioned timetable of bell periods. */
export const BellScheduleId = entityId("BellScheduleId");
export type BellScheduleId = typeof BellScheduleId.Type;

/** Identifies one named period within a bell schedule. */
export const BellPeriodId = entityId("BellPeriodId");
export type BellPeriodId = typeof BellPeriodId.Type;

/** Identifies a recurring lesson rule, independently of its dated occurrences. */
export const RecurringMeetingId = entityId("RecurringMeetingId");
export type RecurringMeetingId = typeof RecurringMeetingId.Type;

/** Identifies one occurrence by its meeting and originally scheduled date. */
export const LessonOccurrenceId = entityId("LessonOccurrenceId");
export type LessonOccurrenceId = typeof LessonOccurrenceId.Type;

/** Identifies a change applied to a particular scheduled occurrence. */
export const ScheduleExceptionId = entityId("ScheduleExceptionId");
export type ScheduleExceptionId = typeof ScheduleExceptionId.Type;
