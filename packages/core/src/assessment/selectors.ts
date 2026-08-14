import * as Option from "effect/Option";
import type { CourseStanding, StandingRevision, WrittenAssessment } from "./model";

export const currentStandingRevision = (
  standing: CourseStanding,
): Option.Option<StandingRevision> =>
  Option.fromUndefinedOr(
    standing.revisions.find((revision) => revision.id === standing.currentRevisionId),
  );

export const isStandingRevisionConfirmed = (revision: StandingRevision): boolean =>
  revision.teacherAttestation !== undefined && revision.learnerAcknowledgement !== undefined;

export const isWrittenAssessmentConfirmed = (assessment: WrittenAssessment): boolean =>
  assessment.teacherAttestation !== undefined && assessment.learnerAcknowledgement !== undefined;

export const lastConfirmedStandingRevision = (
  standing: CourseStanding,
): Option.Option<StandingRevision> => {
  for (let index = standing.revisions.length - 1; index >= 0; index -= 1) {
    const revision = standing.revisions[index];
    if (revision !== undefined && isStandingRevisionConfirmed(revision))
      return Option.some(revision);
  }
  return Option.none();
};

export const confirmedWrittenAssessments = (
  assessments: ReadonlyArray<WrittenAssessment>,
): ReadonlyArray<WrittenAssessment> => assessments.filter(isWrittenAssessmentConfirmed);
