import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import { AggregateRevision } from "../foundation/aggregate-revision";
import type { Artifact } from "../foundation/artifact";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import type { NonBlankText } from "../foundation/non-blank-text";
import type { ActorRef } from "../organization/acknowledgement";
import { Acknowledgement } from "../organization/acknowledgement";
import type { AuthoritySnapshot } from "../organization/authority";
import { Capability, authorize } from "../organization/authority";
import type { Enrollment } from "../organization/enrollment";
import { isEnrollmentEffectiveOn } from "../organization/enrollment";
import type { AcknowledgementId } from "../organization/identity";
import { LessonOccurrence } from "../schedule/lesson-occurrence";
import { AbsenceCase, aggregateName, MissedLesson, MissedLessonDecision } from "./absence-case";
import { MissedLessonId } from "./identity";

export class MissedLessonNotFound extends Schema.TaggedError<MissedLessonNotFound>()(
  "Attendance.MissedLessonNotFound",
  { missedLessonId: MissedLessonId },
) {}

export class MissedLessonAlreadyDecided extends Schema.TaggedError<MissedLessonAlreadyDecided>()(
  "Attendance.MissedLessonAlreadyDecided",
  { missedLessonId: MissedLessonId },
) {}

export class AbsenceNotAcknowledged extends Schema.TaggedError<AbsenceNotAcknowledged>()(
  "Attendance.AbsenceNotAcknowledged",
  { absenceCaseId: AbsenceCase.fields.id },
) {}

export class MissedLessonOccurrenceMismatch extends Schema.TaggedError<MissedLessonOccurrenceMismatch>()(
  "Attendance.MissedLessonOccurrenceMismatch",
  { missedLessonId: MissedLessonId, lessonOccurrenceId: LessonOccurrence.fields.id },
) {}

export class StudentNotEnrolled extends Schema.TaggedError<StudentNotEnrolled>()(
  "Attendance.StudentNotEnrolled",
  { missedLessonId: MissedLessonId },
) {}

export const decideMissedLesson = Effect.fn("Attendance.decideMissedLesson")(function* (
  input: decideMissedLesson.Input,
) {
  yield* AggregateRevision.ensureCurrent(
    aggregateName,
    input.absence.revision,
    input.expectedRevision,
  );
  const lesson = input.absence.missedLessons.find(
    (candidate) => candidate.id === input.missedLessonId,
  );
  if (lesson === undefined) {
    return yield* MissedLessonNotFound.make({ missedLessonId: input.missedLessonId });
  }
  if (lesson.decision._tag !== "Pending") {
    return yield* MissedLessonAlreadyDecided.make({ missedLessonId: input.missedLessonId });
  }
  if (input.absence.acknowledgement === undefined) {
    return yield* AbsenceNotAcknowledged.make({ absenceCaseId: input.absence.id });
  }
  if (
    lesson.lessonOccurrenceId !== input.occurrence.id ||
    lesson.courseOfferingId !== input.occurrence.courseOfferingId ||
    !PlainDate.equals(input.absence.date, input.occurrence.date)
  ) {
    return yield* MissedLessonOccurrenceMismatch.make({
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
    return yield* StudentNotEnrolled.make({ missedLessonId: lesson.id });
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

  const nextRevision = yield* AggregateRevision.next(input.absence.revision);
  const decision: MissedLessonDecision =
    input.decision._tag === "Excused"
      ? MissedLessonDecision.cases.Excused.make({
          acknowledgement: Acknowledgement.make({
            id: input.decision.acknowledgementId,
            actor: input.actor,
            acknowledgedAt: input.decidedAt,
            revision: nextRevision,
            artifact: input.decision.artifact,
          }),
        })
      : MissedLessonDecision.cases.Rejected.make({
          decidedBy: input.actor,
          decidedAt: input.decidedAt,
          revision: nextRevision,
          reason: input.decision.reason,
        });

  const updateLesson = (candidate: MissedLesson) =>
    candidate.id === lesson.id
      ? MissedLesson.make(Struct.assign(candidate, { decision }))
      : candidate;
  const [firstLesson, ...remainingLessons] = input.absence.missedLessons;
  const missedLessons: readonly [MissedLesson, ...Array<MissedLesson>] = [
    updateLesson(firstLesson),
    ...remainingLessons.map(updateLesson),
  ];

  return yield* AggregateRevision.revise(AbsenceCase, input.absence, { missedLessons });
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
      | { readonly _tag: "Rejected"; readonly reason?: NonBlankText };
  }
}
