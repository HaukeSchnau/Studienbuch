import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { CalendarDate } from "../foundation/calendar-date";
import { NonBlankText } from "../foundation/non-blank-text";
import { Acknowledgement } from "../organization/acknowledgement";
import {
  AuthorityDenied,
  AuthoritySnapshot,
  Capability,
  authorize,
} from "../organization/authority";
import { LegalAgePolicy, Person } from "../organization/person";
import { CourseOfferingId, SchoolMembershipId } from "../organization/identity";
import { GradingPolicy } from "./grading-policy";
import { AssessmentWeight, GradeValue } from "./grading";
import { AssessmentId } from "./identity";
import {
  AssessmentAlreadyLearnerAcknowledgedError,
  AssessmentAlreadyTeacherAttestedError,
  AssessmentAcknowledgementActorError,
  AssessmentLegalStatusUnknownError,
  authorizeLearnerAcknowledgement,
  makeAcknowledgement,
} from "./learner-acknowledgement";
import type { ConfirmationRecordInput } from "./learner-acknowledgement";

export const WrittenAssessment = Schema.Struct({
  id: AssessmentId,
  studentMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  title: Schema.optionalKey(NonBlankText.Schema),
  assessedOn: CalendarDate.Schema,
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

export const AttestWrittenError = Schema.Union([
  ConcurrentWrittenAssessmentRevisionError,
  AssessmentAlreadyTeacherAttestedError,
  GradingPolicy.InvalidGradeValueError,
  AuthorityDenied,
]);
export type AttestWrittenError = typeof AttestWrittenError.Type;

export const AcknowledgeWrittenError = Schema.Union([
  ConcurrentWrittenAssessmentRevisionError,
  AssessmentAlreadyLearnerAcknowledgedError,
  AssessmentAcknowledgementActorError,
  AssessmentLegalStatusUnknownError,
  AuthorityDenied,
]);
export type AcknowledgeWrittenError = typeof AcknowledgeWrittenError.Type;

const checkRevision = (assessment: WrittenAssessment, expectedRevision: AggregateRevision.Type) =>
  assessment.revision === expectedRevision
    ? Effect.void
    : Effect.fail(
        new ConcurrentWrittenAssessmentRevisionError({
          expected: expectedRevision,
          actual: assessment.revision,
        }),
      );

export const attestWritten = Effect.fn("Assessment.attestWrittenAssessment")(function* (
  input: attestWritten.Input,
) {
  yield* checkRevision(input.assessment, input.expectedRevision);
  if (input.assessment.teacherAttestation !== undefined) {
    return yield* new AssessmentAlreadyTeacherAttestedError({ target: "WrittenAssessment" });
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
  return WrittenAssessment.make(
    Object.assign({}, input.assessment, {
      revision: AggregateRevision.unsafeNext(input.assessment.revision),
      teacherAttestation: makeAcknowledgement(input, input.assessment.revision),
    }),
  );
});

export declare namespace attestWritten {
  export interface Input extends ConfirmationRecordInput {
    readonly assessment: WrittenAssessment;
    readonly expectedRevision: AggregateRevision.Type;
    readonly authority: AuthoritySnapshot;
  }

  export type Error = AttestWrittenError;
}

export const acknowledgeWritten = Effect.fn("Assessment.acknowledgeWrittenAssessment")(function* (
  input: acknowledgeWritten.Input,
) {
  yield* checkRevision(input.assessment, input.expectedRevision);
  if (input.assessment.learnerAcknowledgement !== undefined) {
    return yield* new AssessmentAlreadyLearnerAcknowledgedError({
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
  return WrittenAssessment.make(
    Object.assign({}, input.assessment, {
      revision: AggregateRevision.unsafeNext(input.assessment.revision),
      learnerAcknowledgement: makeAcknowledgement(input, input.assessment.revision),
    }),
  );
});

export declare namespace acknowledgeWritten {
  export interface Input extends ConfirmationRecordInput {
    readonly assessment: WrittenAssessment;
    readonly expectedRevision: AggregateRevision.Type;
    readonly student: Person;
    readonly legalAgePolicy: LegalAgePolicy;
    readonly authority: AuthoritySnapshot;
  }

  export type Error = AcknowledgeWrittenError;
}
