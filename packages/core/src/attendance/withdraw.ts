import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import type { ActorRef } from "../organization/acknowledgement";
import { Withdrawal } from "../organization/acknowledgement";
import type { AuthoritySnapshot } from "../organization/authority";
import type { AuthorityDenied } from "../organization/authority";
import { Capability, authorize } from "../organization/authority";
import { AbsenceCase, ConcurrentRevision, pendingLessons } from "./absence-case";

export class AlreadyWithdrawn extends Schema.TaggedError<AlreadyWithdrawn>()(
  "Attendance.AlreadyWithdrawn",
  { absenceCaseId: AbsenceCase.fields.id },
) {}

/**
 * A teacher's decision on any missed lesson is the school's record of what happened. Once one
 * exists the student can no longer retract the report it was made against.
 */
export class WithdrawalLockedByDecision extends Schema.TaggedError<WithdrawalLockedByDecision>()(
  "Attendance.WithdrawalLockedByDecision",
  { absenceCaseId: AbsenceCase.fields.id, decided: Schema.Natural },
) {}

export type WithdrawAbsenceError =
  | ConcurrentRevision
  | AlreadyWithdrawn
  | WithdrawalLockedByDecision
  | AggregateRevision.Exhausted
  | AuthorityDenied;

/**
 * Retracts an absence report the student filed, while every missed lesson is still undecided.
 *
 * The case keeps its withdrawal evidence rather than being removed. A peer that has not seen a
 * hard delete would resurrect it on the next sync, and `status` reports `Withdrawn` so projections
 * skip it without having to know the field exists.
 */
export const withdrawAbsence = Effect.fn("Attendance.withdrawAbsence")(function* (
  input: withdrawAbsence.Input,
) {
  if (!AggregateRevision.Equivalence(input.absence.revision, input.expectedRevision)) {
    return yield* ConcurrentRevision.make({
      expected: input.expectedRevision,
      actual: input.absence.revision,
    });
  }
  if (input.absence.withdrawal !== undefined) {
    return yield* AlreadyWithdrawn.make({ absenceCaseId: input.absence.id });
  }
  const decided = input.absence.missedLessons.length - pendingLessons(input.absence).length;
  if (decided > 0) {
    return yield* WithdrawalLockedByDecision.make({
      absenceCaseId: input.absence.id,
      decided: Schema.Natural.make(decided),
    });
  }
  yield* authorize(
    input.actor,
    Capability.cases.ManageOwnNotebook.make({
      studentMembershipId: input.absence.studentMembershipId,
    }),
    input.absence.date,
    input.authority,
  );
  const revision = yield* AggregateRevision.next(input.absence.revision);
  return AbsenceCase.make({
    // oxlint-disable-next-line typescript/no-misused-spread
    ...input.absence,
    revision,
    withdrawal: Withdrawal.make({
      withdrawnBy: input.actor,
      withdrawnAt: input.withdrawnAt,
      revision: input.absence.revision,
    }),
  });
});

export declare namespace withdrawAbsence {
  export interface Input {
    readonly absence: AbsenceCase;
    readonly expectedRevision: AggregateRevision.Type;
    readonly actor: ActorRef;
    readonly withdrawnAt: DateTime.Utc;
    readonly authority: AuthoritySnapshot;
  }
}
