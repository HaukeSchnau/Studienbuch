import * as Schema from "effect/Schema";
import {
  AcknowledgementId,
  ArtifactRef,
  PersonId,
  Revision,
  SchoolMembershipId,
} from "../foundation";

export const ActorRef = Schema.Struct({
  personId: PersonId,
  schoolMembershipId: SchoolMembershipId,
});
export interface ActorRef extends Schema.Schema.Type<typeof ActorRef> {}

export const Acknowledgement = Schema.Struct({
  id: AcknowledgementId,
  actor: ActorRef,
  acknowledgedAt: Schema.DateTimeUtcFromString,
  revision: Revision,
  artifact: Schema.optionalKey(ArtifactRef),
});
export interface Acknowledgement extends Schema.Schema.Type<typeof Acknowledgement> {}
