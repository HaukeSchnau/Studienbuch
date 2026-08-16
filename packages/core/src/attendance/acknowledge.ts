import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { Artifact } from "../foundation/artifact";
import { ActorRef, makeAcknowledgement } from "../organization/acknowledgement";
import {
  AuthorityDenied,
  AuthoritySnapshot,
  Capability,
  authorize,
} from "../organization/authority";
import { LegalAgePolicy, Person, legalStatusOn } from "../organization/person";
import { AcknowledgementId } from "../organization/identity";
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

const checkRevision = (absence: AbsenceCase, expectedRevision: AggregateRevision.Type) =>
  AggregateRevision.Equivalence(absence.revision, expectedRevision)
    ? Effect.void
    : Effect.fail(
        new ConcurrentAbsenceRevisionError({
          expected: expectedRevision,
          actual: absence.revision,
        }),
      );

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

  const acknowledgement = makeAcknowledgement({
    id: input.acknowledgementId,
    actor: input.actor,
    acknowledgedAt: input.acknowledgedAt,
    revision: input.absence.detailsRevision,
    artifact: input.artifact,
  });

  return AbsenceCase.make({
    id: input.absence.id,
    studentMembershipId: input.absence.studentMembershipId,
    date: input.absence.date,
    reason: input.absence.reason,
    detailsRevision: input.absence.detailsRevision,
    revision: AggregateRevision.unsafeNext(input.absence.revision),
    acknowledgement,
    missedLessons: input.absence.missedLessons,
  });
});

export declare namespace acknowledge {
  export interface Input {
    readonly absence: AbsenceCase;
    readonly expectedRevision: AggregateRevision.Type;
    readonly actor: ActorRef;
    readonly student: Person;
    readonly legalAgePolicy: LegalAgePolicy;
    readonly authority: AuthoritySnapshot;
    readonly acknowledgementId: AcknowledgementId;
    readonly acknowledgedAt: DateTime.Utc;
    readonly artifact?: Artifact.Reference;
  }

  export type Error = AcknowledgeError;
}
