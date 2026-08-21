import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { type AcademicCalendar, isSchoolDay } from "./academic-calendar";
import { LessonOccurrenceId, type RecurringMeetingId, type ScheduleExceptionId } from "./identity";
import {
  ConflictingExceptions,
  InvalidInput,
  LessonOccurrence,
  LessonOccurrenceRef,
  type ScheduleException,
  UnresolvedException,
} from "./lesson-occurrence";
import { meetingOccursOn, type RecurringMeeting } from "./recurring-meeting";

export const lessonOccurrenceId = (target: LessonOccurrenceRef): LessonOccurrenceId =>
  LessonOccurrenceId.make(`${target.meetingId}@${PlainDate.toString(target.scheduledDate)}`);

const targetKey = (target: LessonOccurrenceRef) =>
  `${target.meetingId}\u0000${PlainDate.toString(target.scheduledDate)}`;

/**
 * Ordering is lexicographic rather than locale-aware on purpose. `localeCompare` resolves against
 * the runtime's collation, so two devices replaying the same events could apply exceptions in
 * different orders and disagree about the result.
 */
const exceptionOrder = (left: ScheduleException, right: ScheduleException) =>
  Order.String(left.id, right.id);

const occurrenceOrder = (left: LessonOccurrence, right: LessonOccurrence) =>
  PlainDate.compare(left.date, right.date) ||
  left.timeRange.start - right.timeRange.start ||
  left.timeRange.end - right.timeRange.end ||
  Order.String(left.courseOfferingId, right.courseOfferingId) ||
  Order.String(left.id, right.id);

const validateExceptionGroup = (
  exceptions: ReadonlyArray<ScheduleException>,
): ConflictingExceptions | undefined => {
  if (exceptions.length < 2) return undefined;

  const tags = exceptions.map((exception) => exception._tag);
  const hasCancellation = tags.includes("Cancelled");
  const duplicateOperation = new Set(tags).size !== tags.length;
  if (!hasCancellation && !duplicateOperation) return undefined;

  const ordered = [...exceptions].sort(exceptionOrder);
  const first = ordered[0];
  if (first === undefined) return undefined;
  return ConflictingExceptions.make({
    target: first.target,
    exceptionIds: [first.id, ...ordered.slice(1).map((exception) => exception.id)],
  });
};

const applyExceptions = (
  meeting: RecurringMeeting,
  target: LessonOccurrenceRef,
  exceptions: ReadonlyArray<ScheduleException>,
): LessonOccurrence | undefined => {
  const ordered = [...exceptions].sort(exceptionOrder);
  if (ordered.some((exception) => exception._tag === "Cancelled")) return undefined;

  let date = target.scheduledDate;
  let timeRange = meeting.timeRange;
  let room = meeting.room;
  let teacherIds: ReadonlyArray<(typeof meeting.teacherIds)[number]> = meeting.teacherIds;

  for (const exception of ordered) {
    switch (exception._tag) {
      case "Rescheduled":
        date = exception.date;
        timeRange = exception.timeRange;
        break;
      case "RoomChanged":
        room = exception.room;
        break;
      case "TeacherChanged":
        teacherIds = exception.teacherIds;
        break;
    }
  }

  return LessonOccurrence.make({
    id: lessonOccurrenceId(target),
    meetingId: meeting.id,
    courseOfferingId: meeting.courseOfferingId,
    scheduledDate: target.scheduledDate,
    date,
    timeRange,
    bellPeriodId: meeting.bellPeriodId,
    room,
    teacherIds,
    appliedExceptionIds: ordered.map((exception) => exception.id),
  });
};

export const materializeSchoolDay = Effect.fn("Schedule.materializeSchoolDay")(function* (
  input: materializeSchoolDay.Input,
) {
  const meetingIds = new Set<RecurringMeetingId>();
  for (const meeting of input.meetings) {
    if (meetingIds.has(meeting.id)) {
      return yield* InvalidInput.make({
        reason: "DuplicateMeetingId",
        id: meeting.id,
      });
    }
    meetingIds.add(meeting.id);
  }
  const meetingsById = new Map<RecurringMeetingId, RecurringMeeting>(
    input.meetings.map((meeting) => [meeting.id, meeting]),
  );
  const exceptionsByTarget = new Map<string, Array<ScheduleException>>();

  const exceptionIds = new Set<ScheduleExceptionId>();
  for (const exception of input.exceptions) {
    if (exceptionIds.has(exception.id)) {
      return yield* InvalidInput.make({
        reason: "DuplicateExceptionId",
        id: exception.id,
      });
    }
    exceptionIds.add(exception.id);

    const key = targetKey(exception.target);
    const group = exceptionsByTarget.get(key) ?? [];
    group.push(exception);
    exceptionsByTarget.set(key, group);
  }

  for (const group of exceptionsByTarget.values()) {
    const conflict = validateExceptionGroup(group);
    if (conflict !== undefined) return yield* conflict;
  }

  const relevantExceptions = input.exceptions.filter(
    (exception) =>
      PlainDate.equals(exception.target.scheduledDate, input.date) ||
      (exception._tag === "Rescheduled" && PlainDate.equals(exception.date, input.date)),
  );
  for (const exception of relevantExceptions) {
    const meeting = meetingsById.get(exception.target.meetingId);
    if (meeting === undefined) {
      return yield* UnresolvedException.make({
        exceptionId: exception.id,
        target: exception.target,
        reason: "MeetingNotFound",
      });
    }
    if (
      !meetingOccursOn(meeting, exception.target.scheduledDate) ||
      !isSchoolDay(input.calendar, exception.target.scheduledDate)
    ) {
      return yield* UnresolvedException.make({
        exceptionId: exception.id,
        target: exception.target,
        reason: "OccurrenceNotScheduled",
      });
    }
    if (exception._tag === "Rescheduled" && !isSchoolDay(input.calendar, exception.date)) {
      return yield* UnresolvedException.make({
        exceptionId: exception.id,
        target: exception.target,
        reason: "DestinationNotSchoolDay",
      });
    }
  }

  if (!isSchoolDay(input.calendar, input.date)) return [];

  const targets = new Map<string, { meeting: RecurringMeeting; target: LessonOccurrenceRef }>();
  for (const meeting of input.meetings) {
    if (meetingOccursOn(meeting, input.date)) {
      const target = LessonOccurrenceRef.make({ meetingId: meeting.id, scheduledDate: input.date });
      targets.set(targetKey(target), { meeting, target });
    }
  }
  for (const group of exceptionsByTarget.values()) {
    const rescheduled = group.find((exception) => exception._tag === "Rescheduled");
    if (rescheduled?._tag === "Rescheduled" && PlainDate.equals(rescheduled.date, input.date)) {
      const meeting = meetingsById.get(rescheduled.target.meetingId);
      if (meeting !== undefined) {
        targets.set(targetKey(rescheduled.target), { meeting, target: rescheduled.target });
      }
    }
  }

  return [...targets.values()]
    .map(({ meeting, target }) =>
      applyExceptions(meeting, target, exceptionsByTarget.get(targetKey(target)) ?? []),
    )
    .filter(
      (occurrence): occurrence is LessonOccurrence =>
        occurrence !== undefined && PlainDate.equals(occurrence.date, input.date),
    )
    .sort(occurrenceOrder);
});

export declare namespace materializeSchoolDay {
  export interface Input {
    readonly calendar: AcademicCalendar;
    readonly date: PlainDate.Record;
    readonly meetings: ReadonlyArray<RecurringMeeting>;
    readonly exceptions: ReadonlyArray<ScheduleException>;
  }
}
