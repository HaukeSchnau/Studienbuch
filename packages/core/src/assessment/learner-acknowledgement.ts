import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { AggregateRevision } from "../foundation/aggregate-revision";
import type { Artifact } from "../foundation/artifact";
import { PlainDateSchema } from "../foundation/plain-date";
import type * as PlainDate from "temporal-polyfill/fns/PlainDate";
import {
  type Acknowledgement,
  ActorRef,
  makeAcknowledgement as makeOrganizationAcknowledgement,
} from "../organization/acknowledgement";
import type { AuthoritySnapshot } from "../organization/authority";
import { Capability, authorize } from "../organization/authority";
import type { AcknowledgementId, SchoolMembershipId } from "../organization/identity";
import { PersonId } from "../organization/identity";
import type { LegalAgePolicy, Person } from "../organization/person";
import { legalStatusOn } from "../organization/person";

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
  { studentId: PersonId, on: PlainDateSchema },
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
  readonly artifact?: Artifact.Reference;
}

export const makeAcknowledgement = (
  input: ConfirmationRecordInput,
  revision: AggregateRevision.Type,
): Acknowledgement =>
  makeOrganizationAcknowledgement({
    id: input.acknowledgementId,
    actor: input.actor,
    acknowledgedAt: input.acknowledgedAt,
    revision,
    artifact: input.artifact,
  });

export const authorizeLearnerAcknowledgement = Effect.fn(
  "Assessment.authorizeLearnerAcknowledgement",
)(function* (input: {
  readonly actor: ActorRef;
  readonly student: Person;
  readonly studentMembershipId: SchoolMembershipId;
  readonly on: PlainDate.Record;
  readonly legalAgePolicy: LegalAgePolicy;
  readonly authority: AuthoritySnapshot;
}) {
  const studentMembership = input.authority.memberships.find(
    (membership) => membership.id === input.studentMembershipId,
  );
  if (studentMembership?.personId !== input.student.id) {
    return yield* AssessmentAcknowledgementActorError.make({
      actor: input.actor,
      reason: "StudentIdentityMismatch",
    });
  }

  const legalStatus = legalStatusOn(input.student, input.on, input.legalAgePolicy);
  if (legalStatus === "Unknown") {
    return yield* AssessmentLegalStatusUnknownError.make({
      studentId: input.student.id,
      on: input.on,
    });
  }
  const actorIsStudent = input.actor.personId === input.student.id;
  if (legalStatus === "Adult" && !actorIsStudent) {
    return yield* AssessmentAcknowledgementActorError.make({
      actor: input.actor,
      reason: "AdultMustAcknowledgeSelf",
    });
  }
  if (legalStatus === "Minor" && actorIsStudent) {
    return yield* AssessmentAcknowledgementActorError.make({
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
