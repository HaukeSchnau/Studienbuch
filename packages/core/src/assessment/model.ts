import * as Schema from "effect/Schema";
import { Acknowledgement } from "../people/model";
import {
  AssessmentId,
  CalendarDate,
  CourseOfferingId,
  CourseStandingId,
  NonEmptyText,
  Revision,
  SchoolMembershipId,
  StandingRevisionId,
} from "../primitives";

/** Grade values are finite here; the active grading policy owns their valid scale. */
export const GradeValue = Schema.Finite.pipe(Schema.brand("GradeValue"));
export type GradeValue = typeof GradeValue.Type;

export const AssessmentWeight = Schema.Finite.check(Schema.isGreaterThan(0)).pipe(
  Schema.brand("AssessmentWeight"),
);
export type AssessmentWeight = typeof AssessmentWeight.Type;

export const WrittenAssessment = Schema.Struct({
  id: AssessmentId,
  studentMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  title: Schema.optionalKey(NonEmptyText),
  assessedOn: CalendarDate,
  value: GradeValue,
  weight: AssessmentWeight,
  revision: Revision,
  teacherAttestation: Schema.optionalKey(Acknowledgement),
  learnerAcknowledgement: Schema.optionalKey(Acknowledgement),
}).check(
  Schema.makeFilter(
    (assessment) => {
      const records = [assessment.teacherAttestation, assessment.learnerAcknowledgement].filter(
        (record): record is Acknowledgement => record !== undefined,
      );
      return (
        records.every((record) => record.revision <= assessment.revision) &&
        new Set(records.map((record) => record.id)).size === records.length
      );
    },
    { expected: "assessment evidence from an existing revision with unique evidence IDs" },
  ),
);
export interface WrittenAssessment extends Schema.Schema.Type<typeof WrittenAssessment> {}

export const StandingKind = Schema.Literals(["Oral", "Overall"]);
export type StandingKind = typeof StandingKind.Type;

export const StandingRevision = Schema.Struct({
  id: StandingRevisionId,
  value: GradeValue,
  observedOn: CalendarDate,
  supersedes: Schema.optionalKey(StandingRevisionId),
  teacherAttestation: Schema.optionalKey(Acknowledgement),
  learnerAcknowledgement: Schema.optionalKey(Acknowledgement),
});
export interface StandingRevision extends Schema.Schema.Type<typeof StandingRevision> {}

const hasValidRevisionChain = (standing: {
  readonly revision: Revision;
  readonly currentRevisionId: StandingRevisionId;
  readonly revisions: readonly [StandingRevision, ...Array<StandingRevision>];
}) => {
  const ids = new Set(standing.revisions.map((revision) => revision.id));
  if (ids.size !== standing.revisions.length) return false;
  if (standing.revisions.at(-1)?.id !== standing.currentRevisionId) return false;
  const records = standing.revisions.flatMap((revision) => [
    ...(revision.teacherAttestation === undefined ? [] : [revision.teacherAttestation]),
    ...(revision.learnerAcknowledgement === undefined ? [] : [revision.learnerAcknowledgement]),
  ]);
  return (
    records.every((record) => record.revision <= standing.revision) &&
    new Set(records.map((record) => record.id)).size === records.length &&
    standing.revisions.every((revision, index) =>
      index === 0
        ? revision.supersedes === undefined
        : revision.supersedes === standing.revisions[index - 1]?.id,
    )
  );
};

export const CourseStanding = Schema.Struct({
  id: CourseStandingId,
  studentMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  kind: StandingKind,
  revision: Revision,
  currentRevisionId: StandingRevisionId,
  revisions: Schema.NonEmptyArray(StandingRevision),
}).check(
  Schema.makeFilter(hasValidRevisionChain, {
    expected: "a non-branching standing revision chain ending at currentRevisionId",
  }),
);
export interface CourseStanding extends Schema.Schema.Type<typeof CourseStanding> {}

export const GradeAverage = Schema.Struct({
  value: GradeValue,
  assessmentCount: Schema.Int.check(Schema.isGreaterThan(0)),
  totalWeight: Schema.Finite.check(Schema.isGreaterThan(0)),
});
export interface GradeAverage extends Schema.Schema.Type<typeof GradeAverage> {}
