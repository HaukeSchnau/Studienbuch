import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { PlainDateSchema } from "../foundation/plain-date";
import { NonBlankText } from "../foundation/non-blank-text";
import { Acknowledgement } from "../organization/acknowledgement";
import type { AuthoritySnapshot } from "../organization/authority";
import type { AuthorityDenied } from "../organization/authority";
import { Capability, authorize } from "../organization/authority";
import { CourseOfferingId, SchoolMembershipId } from "../organization/identity";
import type { LegalAgePolicy, Person } from "../organization/person";
import { AssessmentWeight, GradeValue } from "./grading";
import { GradingPolicy } from "./grading-policy";
import { AssessmentId } from "./identity";
import type { ConfirmationRecordInput } from "./learner-acknowledgement";
import type {
  AssessmentAcknowledgementActorError,
  AssessmentLegalStatusUnknownError,
} from "./learner-acknowledgement";
import {
  AssessmentAlreadyLearnerAcknowledgedError,
  AssessmentAlreadyTeacherAttestedError,
  authorizeLearnerAcknowledgement,
  makeAcknowledgement,
} from "./learner-acknowledgement";

export const WrittenAssessment = Schema.Struct({
  id: AssessmentId,
  studentMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  title: Schema.optionalKey(NonBlankText.Schema),
  assessedOn: PlainDateSchema,
  value: GradeValue,
  weight: AssessmentWeight,
  revision: AggregateRevision.Schema,
  teacherAttestation: Schema.optionalKey(Acknowledgement),
  learnerAcknowledgement: Schema.optionalKey(Acknowledgement),
}).check(
  Schema.makeFilter(
    (assessment) => {
      const records = [assessment.teacherAttestation, assessment.learnerAcknowledgement].filter(
        (record): record is Acknowledgement => record !== undefined,
      );
      return (
        records.every(
          (record) => AggregateRevision.compare(record.revision, assessment.revision) <= 0,
        ) && new Set(records.map((record) => record.id)).size === records.length
      );
    },
    { expected: "assessment evidence from an existing revision with unique evidence IDs" },
  ),
);
export interface WrittenAssessment extends Schema.Schema.Type<typeof WrittenAssessment> {}

export const isWrittenConfirmed = (assessment: WrittenAssessment): boolean =>
  assessment.teacherAttestation !== undefined && assessment.learnerAcknowledgement !== undefined;

export const confirmedWritten = (
  assessments: ReadonlyArray<WrittenAssessment>,
): ReadonlyArray<WrittenAssessment> => assessments.filter(isWrittenConfirmed);

export class ConcurrentWrittenAssessmentRevisionError extends Schema.TaggedError<ConcurrentWrittenAssessmentRevisionError>()(
  "Assessment.ConcurrentWrittenAssessmentRevision",
  { expected: AggregateRevision.Schema, actual: AggregateRevision.Schema },
) {}

export type AttestWrittenError =
  | ConcurrentWrittenAssessmentRevisionError
  | AssessmentAlreadyTeacherAttestedError
  | AggregateRevision.Exhausted
  | GradingPolicy.InvalidGradeValueError
  | AuthorityDenied;

export type AcknowledgeWrittenError =
  | ConcurrentWrittenAssessmentRevisionError
  | AssessmentAlreadyLearnerAcknowledgedError
  | AggregateRevision.Exhausted
  | AssessmentAcknowledgementActorError
  | AssessmentLegalStatusUnknownError
  | AuthorityDenied;

const checkRevision = (assessment: WrittenAssessment, expectedRevision: AggregateRevision.Type) =>
  assessment.revision === expectedRevision
    ? Effect.void
    : Effect.fail(
        ConcurrentWrittenAssessmentRevisionError.make({
          expected: expectedRevision,
          actual: assessment.revision,
        }),
      );

export const attestWritten = Effect.fn("Assessment.attestWrittenAssessment")(function* (
  input: attestWritten.Input,
) {
  yield* checkRevision(input.assessment, input.expectedRevision);
  if (input.assessment.teacherAttestation !== undefined) {
    return yield* AssessmentAlreadyTeacherAttestedError.make({ target: "WrittenAssessment" });
  }
  const policy = yield* GradingPolicy.Service;
  yield* policy.validateValue(input.assessment.value);
  yield* authorize(
    input.actor,
    Capability.cases.ManageCourseOffering.make({
      courseOfferingId: input.assessment.courseOfferingId,
    }),
    input.assessment.assessedOn,
    input.authority,
  );
  const revision = yield* AggregateRevision.next(input.assessment.revision);
  return WrittenAssessment.make({
    // oxlint-disable-next-line typescript/no-misused-spread
    ...input.assessment,
    revision,
    teacherAttestation: makeAcknowledgement(input, input.assessment.revision),
  });
});

export declare namespace attestWritten {
  export interface Input extends ConfirmationRecordInput {
    readonly assessment: WrittenAssessment;
    readonly expectedRevision: AggregateRevision.Type;
    readonly authority: AuthoritySnapshot;
  }
}

export const acknowledgeWritten = Effect.fn("Assessment.acknowledgeWrittenAssessment")(function* (
  input: acknowledgeWritten.Input,
) {
  yield* checkRevision(input.assessment, input.expectedRevision);
  if (input.assessment.learnerAcknowledgement !== undefined) {
    return yield* AssessmentAlreadyLearnerAcknowledgedError.make({
      target: "WrittenAssessment",
    });
  }
  yield* authorizeLearnerAcknowledgement({
    actor: input.actor,
    student: input.student,
    studentMembershipId: input.assessment.studentMembershipId,
    on: input.assessment.assessedOn,
    legalAgePolicy: input.legalAgePolicy,
    authority: input.authority,
  });
  const revision = yield* AggregateRevision.next(input.assessment.revision);
  return WrittenAssessment.make({
    // oxlint-disable-next-line typescript/no-misused-spread
    ...input.assessment,
    revision,
    learnerAcknowledgement: makeAcknowledgement(input, input.assessment.revision),
  });
});

export declare namespace acknowledgeWritten {
  export interface Input extends ConfirmationRecordInput {
    readonly assessment: WrittenAssessment;
    readonly expectedRevision: AggregateRevision.Type;
    readonly student: Person;
    readonly legalAgePolicy: LegalAgePolicy;
    readonly authority: AuthoritySnapshot;
  }
}
