import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import { CalendarDate } from "../foundation/calendar-date";
import { Acknowledgement } from "../organization/acknowledgement";
import {
  AuthorityDenied,
  AuthoritySnapshot,
  Capability,
  authorize,
} from "../organization/authority";
import { LegalAgePolicy, Person } from "../organization/person";
import { CourseOfferingId, SchoolMembershipId } from "../organization/identity";
import { GradingPolicy } from "./grading-policy";
import { GradeValue } from "./grading";
import { CourseStandingId, StandingRevisionId } from "./identity";
import {
  AssessmentAcknowledgementActorError,
  AssessmentAlreadyLearnerAcknowledgedError,
  AssessmentAlreadyTeacherAttestedError,
  AssessmentLegalStatusUnknownError,
  authorizeLearnerAcknowledgement,
  makeAcknowledgement,
} from "./learner-acknowledgement";
import type { ConfirmationRecordInput } from "./learner-acknowledgement";

export const StandingKind = Schema.Literals(["Oral", "Overall"]);
export type StandingKind = typeof StandingKind.Type;

export const StandingRevision = Schema.Struct({
  id: StandingRevisionId,
  value: GradeValue,
  observedOn: CalendarDate.Schema,
  supersedes: Schema.optionalKey(StandingRevisionId),
  teacherAttestation: Schema.optionalKey(Acknowledgement),
  learnerAcknowledgement: Schema.optionalKey(Acknowledgement),
});
export interface StandingRevision extends Schema.Schema.Type<typeof StandingRevision> {}

const hasValidRevisionChain = (standing: {
  readonly revision: AggregateRevision.Type;
  readonly currentRevisionId: StandingRevisionId;
  readonly revisions: readonly [StandingRevision, ...Array<StandingRevision>];
}) => {
  const ids = new Set(standing.revisions.map((revision) => revision.id));
  if (ids.size !== standing.revisions.length) return false;
  if (standing.revisions.at(-1)?.id !== standing.currentRevisionId) return false;
  const records = standing.revisions.flatMap((revision) => [
    ...(revision.teacherAttestation === undefined ? [] : [revision.teacherAttestation]),
    ...(revision.learnerAcknowledgement === undefined ? [] : [revision.learnerAcknowledgement]),
  ]);
  const isChronological = standing.revisions.every((revision, index) => {
    const previous = standing.revisions[index - 1];
    return (
      previous === undefined || CalendarDate.compare(previous.observedOn, revision.observedOn) <= 0
    );
  });
  return (
    isChronological &&
    records.every((record) => AggregateRevision.compare(record.revision, standing.revision) <= 0) &&
    new Set(records.map((record) => record.id)).size === records.length &&
    standing.revisions.every((revision, index) =>
      index === 0
        ? revision.supersedes === undefined
        : revision.supersedes === standing.revisions[index - 1]?.id,
    )
  );
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

export const currentStandingRevision = (
  standing: CourseStanding,
): Option.Option<StandingRevision> =>
  Option.fromUndefinedOr(
    standing.revisions.find((revision) => revision.id === standing.currentRevisionId),
  );

export const isStandingRevisionConfirmed = (revision: StandingRevision): boolean =>
  revision.teacherAttestation !== undefined && revision.learnerAcknowledgement !== undefined;

export const lastConfirmedStandingRevision = (
  standing: CourseStanding,
): Option.Option<StandingRevision> => {
  for (let index = standing.revisions.length - 1; index >= 0; index -= 1) {
    const revision = standing.revisions[index];
    if (revision !== undefined && isStandingRevisionConfirmed(revision)) {
      return Option.some(revision);
    }
  }
  return Option.none();
};

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
  { previousObservedOn: CalendarDate.Schema, nextObservedOn: CalendarDate.Schema },
) {}

export class StandingRevisionNotCurrentError extends Schema.TaggedError<StandingRevisionNotCurrentError>()(
  "Assessment.StandingRevisionNotCurrent",
  { revisionId: StandingRevisionId, currentRevisionId: StandingRevisionId },
) {}

export const ReviseStandingError = Schema.Union([
  ConcurrentStandingRevisionError,
  StandingRevisionNotFoundError,
  InvalidStandingSupersessionError,
  StandingRevisionChronologyError,
  AssessmentAlreadyTeacherAttestedError,
  AssessmentAlreadyLearnerAcknowledgedError,
  GradingPolicy.InvalidGradeValueError,
]);
export type ReviseStandingError = typeof ReviseStandingError.Type;

export const AttestStandingError = Schema.Union([
  ConcurrentStandingRevisionError,
  StandingRevisionNotFoundError,
  StandingRevisionNotCurrentError,
  AssessmentAlreadyTeacherAttestedError,
  GradingPolicy.InvalidGradeValueError,
  AuthorityDenied,
]);
export type AttestStandingError = typeof AttestStandingError.Type;

export const AcknowledgeStandingError = Schema.Union([
  ConcurrentStandingRevisionError,
  StandingRevisionNotFoundError,
  StandingRevisionNotCurrentError,
  AssessmentAlreadyLearnerAcknowledgedError,
  AssessmentAcknowledgementActorError,
  AssessmentLegalStatusUnknownError,
  AuthorityDenied,
]);
export type AcknowledgeStandingError = typeof AcknowledgeStandingError.Type;

const checkRevision = (standing: CourseStanding, expectedRevision: AggregateRevision.Type) =>
  standing.revision === expectedRevision
    ? Effect.void
    : Effect.fail(
        new ConcurrentStandingRevisionError({
          expected: expectedRevision,
          actual: standing.revision,
        }),
      );

export const reviseStanding = Effect.fn("Assessment.addStandingRevision")(function* (
  input: reviseStanding.Input,
) {
  yield* checkRevision(input.standing, input.expectedRevision);
  if (input.revision.teacherAttestation !== undefined) {
    return yield* new AssessmentAlreadyTeacherAttestedError({ target: "StandingRevision" });
  }
  if (input.revision.learnerAcknowledgement !== undefined) {
    return yield* new AssessmentAlreadyLearnerAcknowledgedError({ target: "StandingRevision" });
  }
  if (input.standing.revisions.some((revision) => revision.id === input.revision.id)) {
    return yield* new InvalidStandingSupersessionError({
      expectedCurrentRevisionId: input.standing.currentRevisionId,
      supersedes: input.revision.id,
    });
  }
  if (input.revision.supersedes !== input.standing.currentRevisionId) {
    return yield* new InvalidStandingSupersessionError({
      expectedCurrentRevisionId: input.standing.currentRevisionId,
      supersedes: input.revision.supersedes ?? input.revision.id,
    });
  }
  const current = yield* currentStandingRevision(input.standing).pipe(
    Effect.fromOption(
      () => new StandingRevisionNotFoundError({ revisionId: input.standing.currentRevisionId }),
    ),
  );
  if (CalendarDate.compare(input.revision.observedOn, current.observedOn) < 0) {
    return yield* new StandingRevisionChronologyError({
      previousObservedOn: current.observedOn,
      nextObservedOn: input.revision.observedOn,
    });
  }

  const policy = yield* GradingPolicy.Service;
  yield* policy.validateValue(input.revision.value);

  return CourseStanding.make(
    Object.assign({}, input.standing, {
      revision: AggregateRevision.unsafeNext(input.standing.revision),
      currentRevisionId: input.revision.id,
      revisions: [...input.standing.revisions, input.revision],
    }),
  );
});

export declare namespace reviseStanding {
  export interface Input {
    readonly standing: CourseStanding;
    readonly expectedRevision: AggregateRevision.Type;
    readonly revision: StandingRevision;
  }

  export type Error = ReviseStandingError;
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
    return yield* new StandingRevisionNotFoundError({ revisionId: input.revisionId });
  }
  if (target.id !== input.standing.currentRevisionId) {
    return yield* new StandingRevisionNotCurrentError({
      revisionId: target.id,
      currentRevisionId: input.standing.currentRevisionId,
    });
  }
  return target;
});

const updateCurrentStanding = (
  input: StandingConfirmationInput,
  target: StandingRevision,
): CourseStanding => {
  const update = (revision: StandingRevision) => (revision.id === target.id ? target : revision);
  const first = input.standing.revisions[0];
  return CourseStanding.make(
    Object.assign({}, input.standing, {
      revision: AggregateRevision.unsafeNext(input.standing.revision),
      revisions: [update(first), ...input.standing.revisions.slice(1).map(update)],
    }),
  );
};

export const attestStanding = Effect.fn("Assessment.attestStandingRevision")(function* (
  input: attestStanding.Input,
) {
  const target = yield* currentTarget(input);
  if (target.teacherAttestation !== undefined) {
    return yield* new AssessmentAlreadyTeacherAttestedError({ target: "StandingRevision" });
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
  return updateCurrentStanding(input, {
    ...target,
    teacherAttestation: makeAcknowledgement(input, input.standing.revision),
  });
});

export declare namespace attestStanding {
  export interface Input extends StandingConfirmationInput {}
  export type Error = AttestStandingError;
}

export const acknowledgeStanding = Effect.fn("Assessment.acknowledgeStandingRevision")(function* (
  input: acknowledgeStanding.Input,
) {
  const target = yield* currentTarget(input);
  if (target.learnerAcknowledgement !== undefined) {
    return yield* new AssessmentAlreadyLearnerAcknowledgedError({
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
  return updateCurrentStanding(input, {
    ...target,
    learnerAcknowledgement: makeAcknowledgement(input, input.standing.revision),
  });
});

export declare namespace acknowledgeStanding {
  export interface Input extends StandingConfirmationInput {
    readonly student: Person;
    readonly legalAgePolicy: LegalAgePolicy;
  }

  export type Error = AcknowledgeStandingError;
}
