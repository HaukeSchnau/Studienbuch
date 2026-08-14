import * as Schema from "effect/Schema";
import { Acknowledgement, ActorRef } from "../people/model";
import {
  AbsenceCaseId,
  CalendarDate,
  CourseOfferingId,
  LessonOccurrenceId,
  MissedLessonId,
  NonEmptyText,
  Revision,
  SchoolMembershipId,
} from "../primitives";

export const AbsenceReason = Schema.TaggedUnion({
  Illness: {},
  Appointment: {},
  SchoolActivity: {},
  Other: { description: NonEmptyText },
});
export type AbsenceReason = typeof AbsenceReason.Type;

export const MissedLessonDecision = Schema.TaggedUnion({
  Pending: {},
  Excused: { acknowledgement: Acknowledgement },
  Rejected: {
    decidedBy: ActorRef,
    decidedAt: Schema.DateTimeUtcFromString,
    revision: Revision,
    reason: Schema.optionalKey(NonEmptyText),
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
  date: CalendarDate,
  reason: AbsenceReason,
  detailsRevision: Revision,
  revision: Revision,
  acknowledgement: Schema.optionalKey(Acknowledgement),
  missedLessons: Schema.NonEmptyArray(MissedLesson),
}).check(
  Schema.makeFilter(
    (absence) =>
      absence.detailsRevision <= absence.revision &&
      (absence.acknowledgement === undefined ||
        absence.acknowledgement.revision === absence.detailsRevision) &&
      new Set(absence.missedLessons.map((lesson) => lesson.id)).size ===
        absence.missedLessons.length &&
      new Set(absence.missedLessons.map((lesson) => lesson.lessonOccurrenceId)).size ===
        absence.missedLessons.length &&
      absence.missedLessons.every((lesson) => {
        switch (lesson.decision._tag) {
          case "Pending":
            return true;
          case "Excused":
            return lesson.decision.acknowledgement.revision <= absence.revision;
          case "Rejected":
            return lesson.decision.revision <= absence.revision;
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

const PositiveCount = Schema.Int.check(Schema.isGreaterThan(0));

export const AbsenceStatus = Schema.TaggedUnion({
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
