import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { PlainDateSchema } from "../foundation/plain-date";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import type { ActorRef } from "../organization/acknowledgement";
import { Acknowledgement } from "../organization/acknowledgement";
import type { AuthoritySnapshot } from "../organization/authority";
import { Capability, authorize } from "../organization/authority";
import type { LegalAgePolicy, Person } from "../organization/person";
import { CourseOfferingId, SchoolMembershipId } from "../organization/identity";
import { GradingPolicy } from "./grading-policy";
import { GradeValue } from "./grading";
import { CourseStandingId, StandingRevisionId } from "./identity";
import {
  AlreadyLearnerAcknowledged,
  AlreadyTeacherAttested,
  authorizeLearnerAcknowledgement,
  makeAcknowledgement,
} from "./learner-acknowledgement";
import type { ConfirmationRecordInput } from "./learner-acknowledgement";

export const StandingKind = Schema.Literals(["Oral", "Overall"]);
export type StandingKind = typeof StandingKind.Type;

export const StandingRevision = Schema.Struct({
  id: StandingRevisionId,
  value: GradeValue,
  observedOn: PlainDateSchema,
  supersedes: Schema.optionalKey(StandingRevisionId),
  teacherAttestation: Schema.optionalKey(Acknowledgement),
  learnerAcknowledgement: Schema.optionalKey(Acknowledgement),
});
export interface StandingRevision extends Schema.Schema.Type<typeof StandingRevision> {}

/**
 * Revisions are immutable history and `currentRevisionId` is a movable pointer into it.
 *
 * The chain was linear until restoring a confirmed grade needed a home. Legacy did that by deleting
 * every revision newer than the confirmed one, which loses evidence and cannot converge when two
 * devices truncate independently. Moving the pointer instead leaves the abandoned revision in place
 * as an auditable dead branch, so the history is append-only and a later revision supersedes
 * whatever was current when it was written.
 *
 * What must still hold: ids are unique, every revision supersedes an existing earlier one, the
 * first supersedes nothing, dates never move backwards along a branch, evidence is unique and
 * never claims a revision the standing has not reached, and the pointer names a real revision.
 */
const hasValidRevisionChain = (standing: {
  readonly revision: AggregateRevision.Type;
  readonly currentRevisionId: StandingRevisionId;
  readonly revisions: readonly [StandingRevision, ...Array<StandingRevision>];
}) => {
  const byId = new Map<StandingRevisionId, StandingRevision>();
  const seenEvidenceIds = new Set<Acknowledgement["id"]>();

  for (const [index, revision] of standing.revisions.entries()) {
    if (byId.has(revision.id)) return false;

    if (index === 0) {
      if (revision.supersedes !== undefined) return false;
    } else {
      if (revision.supersedes === undefined) return false;
      const parent = byId.get(revision.supersedes);
      // Looking the parent up in what came before is what rules out cycles and forward references.
      if (parent === undefined) return false;
      if (PlainDate.compare(parent.observedOn, revision.observedOn) > 0) return false;
    }

    for (const evidence of [revision.teacherAttestation, revision.learnerAcknowledgement]) {
      if (evidence === undefined) continue;
      if (AggregateRevision.compare(evidence.revision, standing.revision) > 0) return false;
      if (seenEvidenceIds.has(evidence.id)) return false;
      seenEvidenceIds.add(evidence.id);
    }

    byId.set(revision.id, revision);
  }

  return byId.has(standing.currentRevisionId);
};

export const CourseStanding = Schema.Struct({
  id: CourseStandingId,
  studentMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  kind: StandingKind,
  revision: AggregateRevision.Schema,
  currentRevisionId: StandingRevisionId,
  revisions: Schema.NonEmptyArray(StandingRevision),
}).check(
  Schema.makeFilter(hasValidRevisionChain, {
    expected: "an acyclic standing revision history whose currentRevisionId names a revision",
  }),
);
export interface CourseStanding extends Schema.Schema.Type<typeof CourseStanding> {}

/** The revision the pointer names, which is not always the most recently written one. */
export const currentStandingRevision = (standing: CourseStanding): StandingRevision =>
  standing.revisions.find((revision) => revision.id === standing.currentRevisionId) ??
  Array.lastNonEmpty(standing.revisions);

export const isStandingRevisionConfirmed = (revision: StandingRevision): boolean =>
  revision.teacherAttestation !== undefined && revision.learnerAcknowledgement !== undefined;

export const lastConfirmedStandingRevision = (
  standing: CourseStanding,
): Option.Option<StandingRevision> =>
  Array.findLast(standing.revisions, isStandingRevisionConfirmed);

/** Names this aggregate in shared revision failures. */
export const aggregateName = AggregateRevision.AggregateName.make("CourseStanding");

export class StandingRevisionNotFound extends Schema.TaggedError<StandingRevisionNotFound>()(
  "Assessment.StandingRevisionNotFound",
  { revisionId: StandingRevisionId },
) {}

export class InvalidStandingSupersession extends Schema.TaggedError<InvalidStandingSupersession>()(
  "Assessment.InvalidStandingSupersession",
  { expectedCurrentRevisionId: StandingRevisionId, supersedes: StandingRevisionId },
) {}

export class StandingRevisionChronology extends Schema.TaggedError<StandingRevisionChronology>()(
  "Assessment.StandingRevisionChronology",
  { previousObservedOn: PlainDateSchema, nextObservedOn: PlainDateSchema },
) {}

export class StandingRevisionNotCurrent extends Schema.TaggedError<StandingRevisionNotCurrent>()(
  "Assessment.StandingRevisionNotCurrent",
  { revisionId: StandingRevisionId, currentRevisionId: StandingRevisionId },
) {}

export const reviseStanding = Effect.fn("Assessment.addStandingRevision")(function* (
  input: reviseStanding.Input,
) {
  yield* AggregateRevision.ensureCurrent(
    aggregateName,
    input.standing.revision,
    input.expectedRevision,
  );
  if (input.revision.teacherAttestation !== undefined) {
    return yield* AlreadyTeacherAttested.make({ target: "StandingRevision" });
  }
  if (input.revision.learnerAcknowledgement !== undefined) {
    return yield* AlreadyLearnerAcknowledged.make({ target: "StandingRevision" });
  }
  if (input.standing.revisions.some((revision) => revision.id === input.revision.id)) {
    return yield* InvalidStandingSupersession.make({
      expectedCurrentRevisionId: input.standing.currentRevisionId,
      supersedes: input.revision.id,
    });
  }
  if (input.revision.supersedes !== input.standing.currentRevisionId) {
    return yield* InvalidStandingSupersession.make({
      expectedCurrentRevisionId: input.standing.currentRevisionId,
      supersedes: input.revision.supersedes ?? input.revision.id,
    });
  }
  const current = currentStandingRevision(input.standing);
  if (PlainDate.compare(input.revision.observedOn, current.observedOn) < 0) {
    return yield* StandingRevisionChronology.make({
      previousObservedOn: current.observedOn,
      nextObservedOn: input.revision.observedOn,
    });
  }

  const policy = yield* GradingPolicy.Service;
  yield* policy.validateValue(input.revision.value);

  return yield* AggregateRevision.revise(CourseStanding, input.standing, {
    currentRevisionId: input.revision.id,
    revisions: [...input.standing.revisions, input.revision],
  });
});

export declare namespace reviseStanding {
  export interface Input {
    readonly standing: CourseStanding;
    readonly expectedRevision: AggregateRevision.Type;
    readonly revision: StandingRevision;
  }
}

interface StandingConfirmationInput extends ConfirmationRecordInput {
  readonly standing: CourseStanding;
  readonly expectedRevision: AggregateRevision.Type;
  readonly revisionId: StandingRevisionId;
  readonly authority: AuthoritySnapshot;
}

const currentTarget = Effect.fn("Assessment.currentStandingTarget")(function* (
  input: StandingConfirmationInput,
) {
  yield* AggregateRevision.ensureCurrent(
    aggregateName,
    input.standing.revision,
    input.expectedRevision,
  );
  const target = input.standing.revisions.find((revision) => revision.id === input.revisionId);
  if (target === undefined) {
    return yield* StandingRevisionNotFound.make({ revisionId: input.revisionId });
  }
  if (target.id !== input.standing.currentRevisionId) {
    return yield* StandingRevisionNotCurrent.make({
      revisionId: target.id,
      currentRevisionId: input.standing.currentRevisionId,
    });
  }
  return target;
});

const updateCurrentStanding = Effect.fn("Assessment.updateCurrentStanding")(function* (
  input: StandingConfirmationInput,
  target: StandingRevision,
) {
  const update = (revision: StandingRevision) => (revision.id === target.id ? target : revision);
  return yield* AggregateRevision.revise(CourseStanding, input.standing, {
    revisions: Array.map(input.standing.revisions, update),
  });
});

export const attestStanding = Effect.fn("Assessment.attestStandingRevision")(function* (
  input: attestStanding.Input,
) {
  const target = yield* currentTarget(input);
  if (target.teacherAttestation !== undefined) {
    return yield* AlreadyTeacherAttested.make({ target: "StandingRevision" });
  }
  const policy = yield* GradingPolicy.Service;
  yield* policy.validateValue(target.value);
  yield* authorize(
    input.actor,
    Capability.cases.ManageCourseOffering.make({
      courseOfferingId: input.standing.courseOfferingId,
    }),
    target.observedOn,
    input.authority,
  );
  return yield* updateCurrentStanding(input, {
    ...target,
    teacherAttestation: makeAcknowledgement(input, input.standing.revision),
  });
});

export declare namespace attestStanding {
  export interface Input extends StandingConfirmationInput {}
}

export const acknowledgeStanding = Effect.fn("Assessment.acknowledgeStandingRevision")(function* (
  input: acknowledgeStanding.Input,
) {
  const target = yield* currentTarget(input);
  if (target.learnerAcknowledgement !== undefined) {
    return yield* AlreadyLearnerAcknowledged.make({
      target: "StandingRevision",
    });
  }
  yield* authorizeLearnerAcknowledgement({
    actor: input.actor,
    student: input.student,
    studentMembershipId: input.standing.studentMembershipId,
    on: target.observedOn,
    legalAgePolicy: input.legalAgePolicy,
    authority: input.authority,
  });
  return yield* updateCurrentStanding(input, {
    ...target,
    learnerAcknowledgement: makeAcknowledgement(input, input.standing.revision),
  });
});

export declare namespace acknowledgeStanding {
  export interface Input extends StandingConfirmationInput {
    readonly student: Person;
    readonly legalAgePolicy: LegalAgePolicy;
  }
}

export class NoConfirmedStandingRevision extends Schema.TaggedError<NoConfirmedStandingRevision>()(
  "Assessment.NoConfirmedStandingRevision",
  { standingId: CourseStandingId },
) {}

/** Nothing to restore: the pointer already names a confirmed revision. */
export class StandingAlreadyConfirmed extends Schema.TaggedError<StandingAlreadyConfirmed>()(
  "Assessment.StandingAlreadyConfirmed",
  { standingId: CourseStandingId, revisionId: StandingRevisionId },
) {}

/**
 * Makes the most recent confirmed revision current again, when the current one is still unconfirmed.
 *
 * The unconfirmed revision is kept, not deleted: it stays in the history as an abandoned branch,
 * and the next revision will supersede whatever is current at that point. Legacy achieved the same
 * outcome by deleting every later grade, which is not something two devices can agree on.
 */
export const restoreLastConfirmedStanding = Effect.fn("Assessment.restoreLastConfirmedStanding")(
  function* (input: restoreLastConfirmedStanding.Input) {
    yield* AggregateRevision.ensureCurrent(
    aggregateName,
    input.standing.revision,
    input.expectedRevision,
  );

    const current = currentStandingRevision(input.standing);
    if (isStandingRevisionConfirmed(current)) {
      return yield* StandingAlreadyConfirmed.make({
        standingId: input.standing.id,
        revisionId: current.id,
      });
    }

    const confirmed = Array.findLast(input.standing.revisions, isStandingRevisionConfirmed);
    if (Option.isNone(confirmed)) {
      return yield* NoConfirmedStandingRevision.make({ standingId: input.standing.id });
    }

    yield* authorize(
      input.actor,
      Capability.cases.ManageOwnNotebook.make({
        studentMembershipId: input.standing.studentMembershipId,
      }),
      confirmed.value.observedOn,
      input.authority,
    );

    return yield* AggregateRevision.revise(CourseStanding, input.standing, {
      currentRevisionId: confirmed.value.id,
    });
  },
);

export declare namespace restoreLastConfirmedStanding {
  export interface Input {
    readonly standing: CourseStanding;
    readonly expectedRevision: AggregateRevision.Type;
    readonly actor: ActorRef;
    readonly authority: AuthoritySnapshot;
  }
}
