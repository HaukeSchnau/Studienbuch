import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import type { Artifact } from "../foundation/artifact";
import { ActorRef, makeAcknowledgement } from "../organization/acknowledgement";
import type { AuthoritySnapshot } from "../organization/authority";
import { Capability, authorize } from "../organization/authority";
import type { LegalAgePolicy } from "../organization/person";
import { Person, legalStatusOn } from "../organization/person";
import type { AcknowledgementId } from "../organization/identity";
import { AbsenceCase, aggregateName } from "./absence-case";

export class AlreadyAcknowledged extends Schema.TaggedError<AlreadyAcknowledged>()(
  "Attendance.AlreadyAcknowledged",
  { absenceCaseId: AbsenceCase.fields.id },
) {}

export class AcknowledgementActor extends Schema.TaggedError<AcknowledgementActor>()(
  "Attendance.AcknowledgementActor",
  {
    actor: ActorRef,
    reason: Schema.Literals(["AdultMustAcknowledgeSelf", "GuardianRequired", "LegalStatusUnknown"]),
  },
) {}

export class StudentIdentity extends Schema.TaggedError<StudentIdentity>()(
  "Attendance.StudentIdentity",
  { absenceCaseId: AbsenceCase.fields.id, personId: Person.fields.id },
) {}

export const acknowledge = Effect.fn("Attendance.acknowledge")(function* (
  input: acknowledge.Input,
) {
  yield* AggregateRevision.ensureCurrent(
    aggregateName,
    input.absence.revision,
    input.expectedRevision,
  );
  if (input.absence.acknowledgement !== undefined) {
    return yield* AlreadyAcknowledged.make({ absenceCaseId: input.absence.id });
  }

  const studentMembership = input.authority.memberships.find(
    (membership) => membership.id === input.absence.studentMembershipId,
  );
  if (studentMembership?.personId !== input.student.id) {
    return yield* StudentIdentity.make({
      absenceCaseId: input.absence.id,
      personId: input.student.id,
    });
  }

  const legalStatus = legalStatusOn(input.student, input.absence.date, input.legalAgePolicy);
  if (legalStatus === "Unknown") {
    return yield* AcknowledgementActor.make({
      actor: input.actor,
      reason: "LegalStatusUnknown",
    });
  }
  const isAdult = legalStatus === "Adult";
  const actorIsStudent = input.actor.personId === input.student.id;

  if (isAdult && !actorIsStudent) {
    return yield* AcknowledgementActor.make({
      actor: input.actor,
      reason: "AdultMustAcknowledgeSelf",
    });
  }
  if (!isAdult && actorIsStudent) {
    return yield* AcknowledgementActor.make({
      actor: input.actor,
      reason: "GuardianRequired",
    });
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

  return yield* AggregateRevision.revise(AbsenceCase, input.absence, { acknowledgement });
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
}
