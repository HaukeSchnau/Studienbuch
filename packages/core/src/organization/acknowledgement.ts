import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { Artifact } from "../foundation/artifact";
import { AcknowledgementId, PersonId, SchoolMembershipId } from "./identity";

export const ActorRef = Schema.Struct({
  personId: PersonId,
  schoolMembershipId: SchoolMembershipId,
});
export interface ActorRef extends Schema.Schema.Type<typeof ActorRef> {}

export const Acknowledgement = Schema.Struct({
  id: AcknowledgementId,
  actor: ActorRef,
  acknowledgedAt: Schema.DateTimeUtcFromString,
  revision: AggregateRevision.Schema,
  artifact: Schema.optionalKey(Artifact.Reference),
});
export interface Acknowledgement extends Schema.Schema.Type<typeof Acknowledgement> {}

export interface AcknowledgementInput {
  readonly id: AcknowledgementId;
  readonly actor: ActorRef;
  readonly acknowledgedAt: Acknowledgement["acknowledgedAt"];
  readonly revision: AggregateRevision.Type;
  readonly artifact: Artifact.Reference | undefined;
}

/** Constructs acknowledgement evidence without admitting a present `undefined` optional field. */
export const makeAcknowledgement = (input: AcknowledgementInput): Acknowledgement => {
  const { artifact, ...fields } = input;
  return artifact === undefined
    ? Acknowledgement.make(fields)
    : Acknowledgement.make({ ...fields, artifact });
};
