import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  AcknowledgementId,
  ArtifactRef,
  CalendarDate,
  PersonId,
  Revision,
  SchoolMembershipId,
} from "../foundation";
import { Acknowledgement, ActorRef } from "../organization/acknowledgement";
import { AuthoritySnapshot, Capability, authorize } from "../organization/authority";
import { LegalAgePolicy, Person, legalStatusOn } from "../organization/person";

export class AssessmentAcknowledgementActorError extends Schema.TaggedError<AssessmentAcknowledgementActorError>()(
  "Assessment.AcknowledgementActor",
  {
    actor: ActorRef,
    reason: Schema.Literals([
      "AdultMustAcknowledgeSelf",
      "GuardianRequired",
      "StudentIdentityMismatch",
    ]),
  },
) {}

/** A missing date of birth is not treated as minority: the legal decision must be explicit. */
export class AssessmentLegalStatusUnknownError extends Schema.TaggedError<AssessmentLegalStatusUnknownError>()(
  "Assessment.LegalStatusUnknown",
  { studentId: PersonId, on: CalendarDate },
) {}

export class AssessmentAlreadyTeacherAttestedError extends Schema.TaggedError<AssessmentAlreadyTeacherAttestedError>()(
  "Assessment.AlreadyTeacherAttested",
  { target: Schema.Literals(["WrittenAssessment", "StandingRevision"]) },
) {}

export class AssessmentAlreadyLearnerAcknowledgedError extends Schema.TaggedError<AssessmentAlreadyLearnerAcknowledgedError>()(
  "Assessment.AlreadyLearnerAcknowledged",
  { target: Schema.Literals(["WrittenAssessment", "StandingRevision"]) },
) {}

export interface ConfirmationRecordInput {
  readonly actor: ActorRef;
  readonly acknowledgementId: AcknowledgementId;
  readonly acknowledgedAt: DateTime.Utc;
  readonly artifact?: ArtifactRef;
}

export const makeAcknowledgement = (
  input: ConfirmationRecordInput,
  revision: Revision,
): Acknowledgement => {
  const fields = {
    id: input.acknowledgementId,
    actor: input.actor,
    acknowledgedAt: input.acknowledgedAt,
    revision,
  };
  return input.artifact === undefined
    ? Acknowledgement.make(fields)
    : Acknowledgement.make({ ...fields, artifact: input.artifact });
};

export const authorizeLearnerAcknowledgement = Effect.fn(
  "Assessment.authorizeLearnerAcknowledgement",
)(function* (input: {
  readonly actor: ActorRef;
  readonly student: Person;
  readonly studentMembershipId: SchoolMembershipId;
  readonly on: CalendarDate;
  readonly legalAgePolicy: LegalAgePolicy;
  readonly authority: AuthoritySnapshot;
}) {
  const studentMembership = input.authority.memberships.find(
    (membership) => membership.id === input.studentMembershipId,
  );
  if (studentMembership?.personId !== input.student.id) {
    return yield* new AssessmentAcknowledgementActorError({
      actor: input.actor,
      reason: "StudentIdentityMismatch",
    });
  }

  const legalStatus = legalStatusOn(input.student, input.on, input.legalAgePolicy);
  if (legalStatus === "Unknown") {
    return yield* new AssessmentLegalStatusUnknownError({
      studentId: input.student.id,
      on: input.on,
    });
  }
  const actorIsStudent = input.actor.personId === input.student.id;
  if (legalStatus === "Adult" && !actorIsStudent) {
    return yield* new AssessmentAcknowledgementActorError({
      actor: input.actor,
      reason: "AdultMustAcknowledgeSelf",
    });
  }
  if (legalStatus === "Minor" && actorIsStudent) {
    return yield* new AssessmentAcknowledgementActorError({
      actor: input.actor,
      reason: "GuardianRequired",
    });
  }
  yield* authorize(
    input.actor,
    actorIsStudent
      ? Capability.cases.ManageOwnNotebook.make({
          studentMembershipId: input.studentMembershipId,
        })
      : Capability.cases.AcknowledgeForStudent.make({
          studentMembershipId: input.studentMembershipId,
        }),
    input.on,
    input.authority,
  );
});
