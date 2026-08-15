import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AcknowledgementId, ArtifactRef, Revision } from "../foundation";
import { Acknowledgement, ActorRef } from "../organization/acknowledgement";
import {
  AuthorityDenied,
  AuthoritySnapshot,
  Capability,
  authorize,
} from "../organization/authority";
import { LegalAgePolicy, Person, legalStatusOn } from "../organization/person";
import { AbsenceCase, ConcurrentAbsenceRevisionError } from "./absence-case";

export class AbsenceAlreadyAcknowledgedError extends Schema.TaggedError<AbsenceAlreadyAcknowledgedError>()(
  "Attendance.AlreadyAcknowledged",
  { absenceCaseId: AbsenceCase.fields.id },
) {}

export class AcknowledgementActorError extends Schema.TaggedError<AcknowledgementActorError>()(
  "Attendance.AcknowledgementActor",
  {
    actor: ActorRef,
    reason: Schema.Literals(["AdultMustAcknowledgeSelf", "GuardianRequired", "LegalStatusUnknown"]),
  },
) {}

export class AbsenceStudentIdentityError extends Schema.TaggedError<AbsenceStudentIdentityError>()(
  "Attendance.StudentIdentity",
  { absenceCaseId: AbsenceCase.fields.id, personId: Person.fields.id },
) {}

export const AcknowledgeError = Schema.Union([
  ConcurrentAbsenceRevisionError,
  AbsenceAlreadyAcknowledgedError,
  AcknowledgementActorError,
  AbsenceStudentIdentityError,
  AuthorityDenied,
]);
export type AcknowledgeError = typeof AcknowledgeError.Type;

const checkRevision = (absence: AbsenceCase, expectedRevision: Revision) =>
  absence.revision === expectedRevision
    ? Effect.void
    : Effect.fail(
        new ConcurrentAbsenceRevisionError({
          expected: expectedRevision,
          actual: absence.revision,
        }),
      );

const makeAcknowledgement = (
  id: AcknowledgementId,
  actor: ActorRef,
  acknowledgedAt: DateTime.Utc,
  revision: Revision,
  artifact: ArtifactRef | undefined,
) => {
  const fields = { id, actor, acknowledgedAt, revision };
  return artifact === undefined
    ? Acknowledgement.make(fields)
    : Acknowledgement.make({ ...fields, artifact });
};

export const acknowledge = Effect.fn("Attendance.acknowledge")(function* (
  input: acknowledge.Input,
) {
  yield* checkRevision(input.absence, input.expectedRevision);
  if (input.absence.acknowledgement !== undefined) {
    return yield* new AbsenceAlreadyAcknowledgedError({ absenceCaseId: input.absence.id });
  }

  const studentMembership = input.authority.memberships.find(
    (membership) => membership.id === input.absence.studentMembershipId,
  );
  if (studentMembership?.personId !== input.student.id) {
    return yield* new AbsenceStudentIdentityError({
      absenceCaseId: input.absence.id,
      personId: input.student.id,
    });
  }

  const legalStatus = legalStatusOn(input.student, input.absence.date, input.legalAgePolicy);
  if (legalStatus === "Unknown") {
    return yield* new AcknowledgementActorError({
      actor: input.actor,
      reason: "LegalStatusUnknown",
    });
  }
  const isAdult = legalStatus === "Adult";
  const actorIsStudent = input.actor.personId === input.student.id;

  if (isAdult && !actorIsStudent) {
    return yield* new AcknowledgementActorError({
      actor: input.actor,
      reason: "AdultMustAcknowledgeSelf",
    });
  }
  if (!isAdult && actorIsStudent) {
    return yield* new AcknowledgementActorError({ actor: input.actor, reason: "GuardianRequired" });
  }

  yield* authorize(
    input.actor,
    actorIsStudent
      ? Capability.cases.ManageOwnNotebook.make({
          studentMembershipId: input.absence.studentMembershipId,
        })
      : Capability.cases.AcknowledgeForStudent.make({
          studentMembershipId: input.absence.studentMembershipId,
        }),
    input.absence.date,
    input.authority,
  );

  const acknowledgement = makeAcknowledgement(
    input.acknowledgementId,
    input.actor,
    input.acknowledgedAt,
    input.absence.detailsRevision,
    input.artifact,
  );

  return AbsenceCase.make({
    id: input.absence.id,
    studentMembershipId: input.absence.studentMembershipId,
    date: input.absence.date,
    reason: input.absence.reason,
    detailsRevision: input.absence.detailsRevision,
    revision: Revision.make(input.absence.revision + 1),
    acknowledgement,
    missedLessons: input.absence.missedLessons,
  });
});

export declare namespace acknowledge {
  export interface Input {
    readonly absence: AbsenceCase;
    readonly expectedRevision: Revision;
    readonly actor: ActorRef;
    readonly student: Person;
    readonly legalAgePolicy: LegalAgePolicy;
    readonly authority: AuthoritySnapshot;
    readonly acknowledgementId: AcknowledgementId;
    readonly acknowledgedAt: DateTime.Utc;
    readonly artifact?: ArtifactRef;
  }

  export type Error = AcknowledgeError;
}
