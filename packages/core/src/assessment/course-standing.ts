import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { PlainDateSchema } from "../foundation/plain-date";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { Acknowledgement } from "../organization/acknowledgement";
import type { AuthoritySnapshot } from "../organization/authority";
import type { AuthorityDenied } from "../organization/authority";
import { Capability, authorize } from "../organization/authority";
import type { LegalAgePolicy, Person } from "../organization/person";
import { CourseOfferingId, SchoolMembershipId } from "../organization/identity";
import { GradingPolicy } from "./grading-policy";
import { GradeValue } from "./grading";
import { CourseStandingId, StandingRevisionId } from "./identity";
import type {
  AssessmentAcknowledgementActorError,
  AssessmentLegalStatusUnknownError,
} from "./learner-acknowledgement";
import {
  AssessmentAlreadyLearnerAcknowledgedError,
  AssessmentAlreadyTeacherAttestedError,
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
 * The chain must be append-only and unbranched: each revision supersedes exactly its predecessor,
 * observation dates never move backwards, evidence is unique and never claims a revision the
 * standing has not reached, and the last link is the current one.
 *
 * One pass, because `Schema.make` re-runs this on every append.
 */
const hasValidRevisionChain = (standing: {
  readonly revision: AggregateRevision.Type;
  readonly currentRevisionId: StandingRevisionId;
  readonly revisions: readonly [StandingRevision, ...Array<StandingRevision>];
}) => {
  const seenRevisionIds = new Set<StandingRevisionId>();
  const seenEvidenceIds = new Set<Acknowledgement["id"]>();
  let previous: StandingRevision | undefined;

  for (const revision of standing.revisions) {
    if (seenRevisionIds.has(revision.id)) return false;
    seenRevisionIds.add(revision.id);

    if (revision.supersedes !== previous?.id) return false;
    if (previous !== undefined && PlainDate.compare(previous.observedOn, revision.observedOn) > 0) {
      return false;
    }

    for (const evidence of [revision.teacherAttestation, revision.learnerAcknowledgement]) {
      if (evidence === undefined) continue;
      if (AggregateRevision.compare(evidence.revision, standing.revision) > 0) return false;
      if (seenEvidenceIds.has(evidence.id)) return false;
      seenEvidenceIds.add(evidence.id);
    }

    previous = revision;
  }

  return previous?.id === standing.currentRevisionId;
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
    expected: "a non-branching standing revision chain ending at currentRevisionId",
  }),
);
export interface CourseStanding extends Schema.Schema.Type<typeof CourseStanding> {}

export const currentStandingRevision = (standing: CourseStanding): StandingRevision =>
  Array.lastNonEmpty(standing.revisions);

export const isStandingRevisionConfirmed = (revision: StandingRevision): boolean =>
  revision.teacherAttestation !== undefined && revision.learnerAcknowledgement !== undefined;

export const lastConfirmedStandingRevision = (
  standing: CourseStanding,
): Option.Option<StandingRevision> =>
  Array.findLast(standing.revisions, isStandingRevisionConfirmed);

export class ConcurrentStandingRevisionError extends Schema.TaggedError<ConcurrentStandingRevisionError>()(
  "Assessment.ConcurrentStandingRevision",
  { expected: AggregateRevision.Schema, actual: AggregateRevision.Schema },
) {}

export class StandingRevisionNotFoundError extends Schema.TaggedError<StandingRevisionNotFoundError>()(
  "Assessment.StandingRevisionNotFound",
  { revisionId: StandingRevisionId },
) {}

export class InvalidStandingSupersessionError extends Schema.TaggedError<InvalidStandingSupersessionError>()(
  "Assessment.InvalidStandingSupersession",
  { expectedCurrentRevisionId: StandingRevisionId, supersedes: StandingRevisionId },
) {}

export class StandingRevisionChronologyError extends Schema.TaggedError<StandingRevisionChronologyError>()(
  "Assessment.StandingRevisionChronology",
  { previousObservedOn: PlainDateSchema, nextObservedOn: PlainDateSchema },
) {}

export class StandingRevisionNotCurrentError extends Schema.TaggedError<StandingRevisionNotCurrentError>()(
  "Assessment.StandingRevisionNotCurrent",
  { revisionId: StandingRevisionId, currentRevisionId: StandingRevisionId },
) {}

export type ReviseStandingError =
  | ConcurrentStandingRevisionError
  | StandingRevisionNotFoundError
  | InvalidStandingSupersessionError
  | StandingRevisionChronologyError
  | AssessmentAlreadyTeacherAttestedError
  | AssessmentAlreadyLearnerAcknowledgedError
  | AggregateRevision.Exhausted
  | GradingPolicy.InvalidGradeValueError;

export type AttestStandingError =
  | ConcurrentStandingRevisionError
  | StandingRevisionNotFoundError
  | StandingRevisionNotCurrentError
  | AssessmentAlreadyTeacherAttestedError
  | AggregateRevision.Exhausted
  | GradingPolicy.InvalidGradeValueError
  | AuthorityDenied;

export type AcknowledgeStandingError =
  | ConcurrentStandingRevisionError
  | StandingRevisionNotFoundError
  | StandingRevisionNotCurrentError
  | AssessmentAlreadyLearnerAcknowledgedError
  | AssessmentAcknowledgementActorError
  | AssessmentLegalStatusUnknownError
  | AggregateRevision.Exhausted
  | AuthorityDenied;

const checkRevision = (standing: CourseStanding, expectedRevision: AggregateRevision.Type) =>
  standing.revision === expectedRevision
    ? Effect.void
    : Effect.fail(
        ConcurrentStandingRevisionError.make({
          expected: expectedRevision,
          actual: standing.revision,
        }),
      );

export const reviseStanding = Effect.fn("Assessment.addStandingRevision")(function* (
  input: reviseStanding.Input,
) {
  yield* checkRevision(input.standing, input.expectedRevision);
  if (input.revision.teacherAttestation !== undefined) {
    return yield* AssessmentAlreadyTeacherAttestedError.make({ target: "StandingRevision" });
  }
  if (input.revision.learnerAcknowledgement !== undefined) {
    return yield* AssessmentAlreadyLearnerAcknowledgedError.make({ target: "StandingRevision" });
  }
  if (input.standing.revisions.some((revision) => revision.id === input.revision.id)) {
    return yield* InvalidStandingSupersessionError.make({
      expectedCurrentRevisionId: input.standing.currentRevisionId,
      supersedes: input.revision.id,
    });
  }
  if (input.revision.supersedes !== input.standing.currentRevisionId) {
    return yield* InvalidStandingSupersessionError.make({
      expectedCurrentRevisionId: input.standing.currentRevisionId,
      supersedes: input.revision.supersedes ?? input.revision.id,
    });
  }
  const current = currentStandingRevision(input.standing);
  if (PlainDate.compare(input.revision.observedOn, current.observedOn) < 0) {
    return yield* StandingRevisionChronologyError.make({
      previousObservedOn: current.observedOn,
      nextObservedOn: input.revision.observedOn,
    });
  }

  const policy = yield* GradingPolicy.Service;
  yield* policy.validateValue(input.revision.value);

  const revision = yield* AggregateRevision.next(input.standing.revision);
  return CourseStanding.make({
    // `Schema.Struct` values are plain objects (Object.prototype), so spreading one keeps every
    // property. The rule reads the merged `interface X extends Schema.Schema.Type<typeof X>`
    // declaration as a class. Verified with a prototype assertion before suppressing.
    // oxlint-disable-next-line typescript/no-misused-spread
    ...input.standing,
    revision,
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
  yield* checkRevision(input.standing, input.expectedRevision);
  const target = input.standing.revisions.find((revision) => revision.id === input.revisionId);
  if (target === undefined) {
    return yield* StandingRevisionNotFoundError.make({ revisionId: input.revisionId });
  }
  if (target.id !== input.standing.currentRevisionId) {
    return yield* StandingRevisionNotCurrentError.make({
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
  const revision = yield* AggregateRevision.next(input.standing.revision);
  return CourseStanding.make({
    // `Schema.Struct` values are plain objects (Object.prototype), so spreading one keeps every
    // property. The rule reads the merged `interface X extends Schema.Schema.Type<typeof X>`
    // declaration as a class. Verified with a prototype assertion before suppressing.
    // oxlint-disable-next-line typescript/no-misused-spread
    ...input.standing,
    revision,
    revisions: Array.map(input.standing.revisions, update),
  });
});

export const attestStanding = Effect.fn("Assessment.attestStandingRevision")(function* (
  input: attestStanding.Input,
) {
  const target = yield* currentTarget(input);
  if (target.teacherAttestation !== undefined) {
    return yield* AssessmentAlreadyTeacherAttestedError.make({ target: "StandingRevision" });
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
    return yield* AssessmentAlreadyLearnerAcknowledgedError.make({
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
