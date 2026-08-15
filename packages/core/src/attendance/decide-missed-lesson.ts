import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as AggregateRevision from "../foundation/aggregate-revision";
import * as Artifact from "../foundation/artifact";
import * as CalendarDate from "../foundation/calendar-date";
import * as NonBlankText from "../foundation/non-blank-text";
import { ActorRef, makeAcknowledgement } from "../organization/acknowledgement";
import {
  AuthorityDenied,
  AuthoritySnapshot,
  Capability,
  authorize,
} from "../organization/authority";
import { Enrollment, isEnrollmentEffectiveOn } from "../organization/enrollment";
import { AcknowledgementId } from "../organization/identity";
import { LessonOccurrence } from "../schedule/lesson-occurrence";
import {
  AbsenceCase,
  ConcurrentAbsenceRevisionError,
  MissedLesson,
  MissedLessonDecision,
} from "./absence-case";
import { MissedLessonId } from "./identity";

export class MissedLessonNotFoundError extends Schema.TaggedError<MissedLessonNotFoundError>()(
  "Attendance.MissedLessonNotFound",
  { missedLessonId: MissedLessonId },
) {}

export class MissedLessonAlreadyDecidedError extends Schema.TaggedError<MissedLessonAlreadyDecidedError>()(
  "Attendance.MissedLessonAlreadyDecided",
  { missedLessonId: MissedLessonId },
) {}

export class AbsenceNotAcknowledgedError extends Schema.TaggedError<AbsenceNotAcknowledgedError>()(
  "Attendance.AbsenceNotAcknowledged",
  { absenceCaseId: AbsenceCase.fields.id },
) {}

export class MissedLessonOccurrenceMismatchError extends Schema.TaggedError<MissedLessonOccurrenceMismatchError>()(
  "Attendance.MissedLessonOccurrenceMismatch",
  { missedLessonId: MissedLessonId, lessonOccurrenceId: LessonOccurrence.fields.id },
) {}

export class StudentNotEnrolledError extends Schema.TaggedError<StudentNotEnrolledError>()(
  "Attendance.StudentNotEnrolled",
  { missedLessonId: MissedLessonId },
) {}

export const DecideMissedLessonError = Schema.Union([
  ConcurrentAbsenceRevisionError,
  MissedLessonNotFoundError,
  MissedLessonAlreadyDecidedError,
  AbsenceNotAcknowledgedError,
  MissedLessonOccurrenceMismatchError,
  StudentNotEnrolledError,
  AuthorityDenied,
]);
export type DecideMissedLessonError = typeof DecideMissedLessonError.Type;

const checkRevision = (absence: AbsenceCase, expectedRevision: AggregateRevision.Type) =>
  AggregateRevision.Equivalence(absence.revision, expectedRevision)
    ? Effect.void
    : Effect.fail(
        new ConcurrentAbsenceRevisionError({
          expected: expectedRevision,
          actual: absence.revision,
        }),
      );

export const decideMissedLesson = Effect.fn("Attendance.decideMissedLesson")(function* (
  input: decideMissedLesson.Input,
) {
  yield* checkRevision(input.absence, input.expectedRevision);
  const lesson = input.absence.missedLessons.find(
    (candidate) => candidate.id === input.missedLessonId,
  );
  if (lesson === undefined) {
    return yield* new MissedLessonNotFoundError({ missedLessonId: input.missedLessonId });
  }
  if (lesson.decision._tag !== "Pending") {
    return yield* new MissedLessonAlreadyDecidedError({ missedLessonId: input.missedLessonId });
  }
  if (input.absence.acknowledgement === undefined) {
    return yield* new AbsenceNotAcknowledgedError({ absenceCaseId: input.absence.id });
  }
  if (
    lesson.lessonOccurrenceId !== input.occurrence.id ||
    lesson.courseOfferingId !== input.occurrence.courseOfferingId ||
    !CalendarDate.Equivalence(input.absence.date, input.occurrence.date)
  ) {
    return yield* new MissedLessonOccurrenceMismatchError({
      missedLessonId: lesson.id,
      lessonOccurrenceId: input.occurrence.id,
    });
  }
  if (
    !input.enrollments.some(
      (enrollment) =>
        enrollment.studentMembershipId === input.absence.studentMembershipId &&
        enrollment.courseOfferingId === input.occurrence.courseOfferingId &&
        isEnrollmentEffectiveOn(enrollment, input.occurrence.date),
    )
  ) {
    return yield* new StudentNotEnrolledError({ missedLessonId: lesson.id });
  }

  yield* authorize(
    input.actor,
    Capability.cases.DecideCourseAttendance.make({
      studentMembershipId: input.absence.studentMembershipId,
      courseOfferingId: lesson.courseOfferingId,
    }),
    input.absence.date,
    input.authority,
  );

  const nextRevision = AggregateRevision.unsafeNext(input.absence.revision);
  let decision: MissedLessonDecision;
  if (input.decision._tag === "Excused") {
    decision = MissedLessonDecision.cases.Excused.make({
      acknowledgement: makeAcknowledgement({
        id: input.decision.acknowledgementId,
        actor: input.actor,
        acknowledgedAt: input.decidedAt,
        revision: nextRevision,
        artifact: input.decision.artifact,
      }),
    });
  } else {
    const fields = {
      decidedBy: input.actor,
      decidedAt: input.decidedAt,
      revision: nextRevision,
    };
    decision =
      input.decision.reason === undefined
        ? MissedLessonDecision.cases.Rejected.make(fields)
        : MissedLessonDecision.cases.Rejected.make({ ...fields, reason: input.decision.reason });
  }

  const updateLesson = (candidate: MissedLesson) =>
    candidate.id === lesson.id
      ? MissedLesson.make({
          id: candidate.id,
          lessonOccurrenceId: candidate.lessonOccurrenceId,
          courseOfferingId: candidate.courseOfferingId,
          decision,
        })
      : candidate;
  const [firstLesson, ...remainingLessons] = input.absence.missedLessons;
  const nextLessons: readonly [MissedLesson, ...Array<MissedLesson>] = [
    updateLesson(firstLesson),
    ...remainingLessons.map(updateLesson),
  ];

  const nextAbsence = {
    id: input.absence.id,
    studentMembershipId: input.absence.studentMembershipId,
    date: input.absence.date,
    reason: input.absence.reason,
    detailsRevision: input.absence.detailsRevision,
    revision: nextRevision,
    missedLessons: nextLessons,
  };
  return input.absence.acknowledgement === undefined
    ? AbsenceCase.make(nextAbsence)
    : AbsenceCase.make({
        ...nextAbsence,
        acknowledgement: input.absence.acknowledgement,
      });
});

export declare namespace decideMissedLesson {
  export interface Input {
    readonly absence: AbsenceCase;
    readonly expectedRevision: AggregateRevision.Type;
    readonly missedLessonId: MissedLessonId;
    /** Authoritative materialized occurrence loaded by the application boundary. */
    readonly occurrence: LessonOccurrence;
    readonly enrollments: ReadonlyArray<Enrollment>;
    readonly actor: ActorRef;
    readonly authority: AuthoritySnapshot;
    readonly decidedAt: DateTime.Utc;
    readonly decision:
      | {
          readonly _tag: "Excused";
          readonly acknowledgementId: AcknowledgementId;
          readonly artifact?: Artifact.Reference;
        }
      | { readonly _tag: "Rejected"; readonly reason?: NonBlankText.Type };
  }

  export type Error = DecideMissedLessonError;
}
