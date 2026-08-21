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
  artifact: Schema.optional(Artifact.Reference),
});
export interface Acknowledgement extends Schema.Schema.Type<typeof Acknowledgement> {}

/**
 * Evidence that an authorized actor retracted a record they had entered.
 *
 * Withdrawal is recorded rather than deleted. A peer that has not yet seen a hard delete would
 * resurrect the row on the next sync, so the aggregate keeps a tombstone and projections skip it.
 */
export const Withdrawal = Schema.Struct({
  withdrawnBy: ActorRef,
  withdrawnAt: Schema.DateTimeUtcFromString,
  revision: AggregateRevision.Schema,
});
export interface Withdrawal extends Schema.Schema.Type<typeof Withdrawal> {}
