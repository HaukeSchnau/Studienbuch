import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { PlainDateSchema } from "../foundation/plain-date";
import { NonBlankText } from "../foundation/non-blank-text";
import { Acknowledgement, ActorRef, Withdrawal } from "../organization/acknowledgement";
import { CourseOfferingId, SchoolMembershipId } from "../organization/identity";
import { LessonOccurrenceId } from "../schedule/identity";
import { AbsenceCaseId, MissedLessonId } from "./identity";

export const AbsenceReason = Schema.TaggedUnion({
  Illness: {},
  Appointment: {},
  SchoolActivity: {},
  Other: { description: NonBlankText },
});
export type AbsenceReason = typeof AbsenceReason.Type;

export const MissedLessonDecision = Schema.TaggedUnion({
  Pending: {},
  Excused: { acknowledgement: Acknowledgement },
  Rejected: {
    decidedBy: ActorRef,
    decidedAt: Schema.DateTimeUtcFromString,
    revision: AggregateRevision.Schema,
    reason: Schema.optional(NonBlankText),
  },
});
export type MissedLessonDecision = typeof MissedLessonDecision.Type;

export const MissedLesson = Schema.Struct({
  id: MissedLessonId,
  lessonOccurrenceId: LessonOccurrenceId,
  courseOfferingId: CourseOfferingId,
  decision: MissedLessonDecision,
});
export interface MissedLesson extends Schema.Schema.Type<typeof MissedLesson> {}

/**
 * A single absence report with independently decided missed lessons. `detailsRevision`
 * identifies the facts seen by the acknowledging person; teacher decisions advance the
 * aggregate `revision` without invalidating that acknowledgement.
 */
export const AbsenceCase = Schema.Struct({
  id: AbsenceCaseId,
  studentMembershipId: SchoolMembershipId,
  date: PlainDateSchema,
  reason: AbsenceReason,
  detailsRevision: AggregateRevision.Schema,
  revision: AggregateRevision.Schema,
  acknowledgement: Schema.optional(Acknowledgement),
  withdrawal: Schema.optional(Withdrawal),
  missedLessons: Schema.NonEmptyArray(MissedLesson),
}).check(
  Schema.makeFilter(
    (absence) =>
      AggregateRevision.compare(absence.detailsRevision, absence.revision) <= 0 &&
      (absence.acknowledgement === undefined ||
        AggregateRevision.compare(absence.acknowledgement.revision, absence.detailsRevision) ===
          0) &&
      new Set(absence.missedLessons.map((lesson) => lesson.id)).size ===
        absence.missedLessons.length &&
      new Set(absence.missedLessons.map((lesson) => lesson.lessonOccurrenceId)).size ===
        absence.missedLessons.length &&
      absence.missedLessons.every((lesson) => {
        switch (lesson.decision._tag) {
          case "Pending":
            return true;
          case "Excused":
            return (
              AggregateRevision.compare(
                lesson.decision.acknowledgement.revision,
                absence.revision,
              ) <= 0
            );
          case "Rejected":
            return AggregateRevision.compare(lesson.decision.revision, absence.revision) <= 0;
        }
      }) &&
      (() => {
        const evidenceIds = [
          ...(absence.acknowledgement === undefined ? [] : [absence.acknowledgement.id]),
          ...absence.missedLessons.flatMap((lesson) =>
            lesson.decision._tag === "Excused" ? [lesson.decision.acknowledgement.id] : [],
          ),
        ];
        return new Set(evidenceIds).size === evidenceIds.length;
      })(),
    {
      expected:
        "an absence case with unique lesson and occurrence IDs and an acknowledgement of its current details revision",
    },
  ),
);
export interface AbsenceCase extends Schema.Schema.Type<typeof AbsenceCase> {}

/** Names this aggregate in shared revision failures. */
export const aggregateName = AggregateRevision.AggregateName.make("AbsenceCase");

const PositiveCount = Schema.Int.check(Schema.isGreaterThan(0));

export const AbsenceStatus = Schema.TaggedUnion({
  Withdrawn: {},
  AwaitingAcknowledgement: {},
  AwaitingLessonDecisions: { pending: PositiveCount },
  PartiallyResolved: {
    excused: Schema.Natural,
    rejected: Schema.Natural,
    pending: PositiveCount,
  },
  ResolvedExcused: {},
  ResolvedRejected: {},
  ResolvedMixed: { excused: PositiveCount, rejected: PositiveCount },
});
export type AbsenceStatus = typeof AbsenceStatus.Type;

export const pendingLessons = (absence: AbsenceCase): ReadonlyArray<MissedLesson> =>
  absence.missedLessons.filter((lesson) => lesson.decision._tag === "Pending");

export const excusedLessons = (absence: AbsenceCase): ReadonlyArray<MissedLesson> =>
  absence.missedLessons.filter((lesson) => lesson.decision._tag === "Excused");

export const rejectedLessons = (absence: AbsenceCase): ReadonlyArray<MissedLesson> =>
  absence.missedLessons.filter((lesson) => lesson.decision._tag === "Rejected");

export const isAbsenceWithdrawn = (absence: AbsenceCase): boolean =>
  absence.withdrawal !== undefined;

export const status = (absence: AbsenceCase): AbsenceStatus => {
  if (absence.withdrawal !== undefined) {
    return { _tag: "Withdrawn" };
  }
  if (absence.acknowledgement === undefined) {
    return { _tag: "AwaitingAcknowledgement" };
  }

  const pending = pendingLessons(absence).length;
  const excused = excusedLessons(absence).length;
  const rejected = rejectedLessons(absence).length;

  if (pending > 0 && excused + rejected === 0) {
    return { _tag: "AwaitingLessonDecisions", pending };
  }
  if (pending > 0) {
    return { _tag: "PartiallyResolved", excused, rejected, pending };
  }
  if (rejected === 0) return { _tag: "ResolvedExcused" };
  if (excused === 0) return { _tag: "ResolvedRejected" };
  return { _tag: "ResolvedMixed", excused, rejected };
};
