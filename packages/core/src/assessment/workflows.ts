import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AuthorityDenied, AuthoritySnapshot, Capability, authorize } from "../people/authority";
import { Acknowledgement, ActorRef, LegalAgePolicy, Person, legalStatusOn } from "../people/model";
import {
  AcknowledgementId,
  ArtifactRef,
  CalendarDate,
  PersonId,
  Revision,
  StandingRevisionId,
} from "../primitives";
import { GradingPolicy, InvalidGradeValueError } from "./grading-policy";
import { CourseStanding, StandingRevision, WrittenAssessment } from "./model";
import { currentStandingRevision } from "./selectors";

export class ConcurrentWrittenAssessmentRevisionError extends Schema.TaggedError<ConcurrentWrittenAssessmentRevisionError>()(
  "Assessment.ConcurrentWrittenAssessmentRevision",
  { expected: Revision, actual: Revision },
) {}

export class ConcurrentStandingRevisionError extends Schema.TaggedError<ConcurrentStandingRevisionError>()(
  "Assessment.ConcurrentStandingRevision",
  { expected: Revision, actual: Revision },
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
  { previousObservedOn: CalendarDate, nextObservedOn: CalendarDate },
) {}

export class AssessmentAlreadyTeacherAttestedError extends Schema.TaggedError<AssessmentAlreadyTeacherAttestedError>()(
  "Assessment.AlreadyTeacherAttested",
  { target: Schema.Literals(["WrittenAssessment", "StandingRevision"]) },
) {}

export class AssessmentAlreadyLearnerAcknowledgedError extends Schema.TaggedError<AssessmentAlreadyLearnerAcknowledgedError>()(
  "Assessment.AlreadyLearnerAcknowledged",
  { target: Schema.Literals(["WrittenAssessment", "StandingRevision"]) },
) {}

export class StandingRevisionNotCurrentError extends Schema.TaggedError<StandingRevisionNotCurrentError>()(
  "Assessment.StandingRevisionNotCurrent",
  { revisionId: StandingRevisionId, currentRevisionId: StandingRevisionId },
) {}

export class AssessmentAcknowledgementActorError extends Schema.TaggedError<AssessmentAcknowledgementActorError>()(
  "Assessment.AcknowledgementActor",
  {
    actor: ActorRef,
    reason: Schema.Literals([
      "AdultMustAcknowledgeSelf",
      "GuardianRequired",
      "StudentIdentityMismatch",
    ]),
  },
) {}

/** A missing date of birth is not treated as minority: the legal decision must be explicit. */
export class AssessmentLegalStatusUnknownError extends Schema.TaggedError<AssessmentLegalStatusUnknownError>()(
  "Assessment.LegalStatusUnknown",
  { studentId: PersonId, on: CalendarDate },
) {}

export const AssessmentConfirmationError = Schema.Union([
  ConcurrentWrittenAssessmentRevisionError,
  ConcurrentStandingRevisionError,
  StandingRevisionNotFoundError,
  InvalidStandingSupersessionError,
  StandingRevisionChronologyError,
  AssessmentAlreadyTeacherAttestedError,
  AssessmentAlreadyLearnerAcknowledgedError,
  StandingRevisionNotCurrentError,
  AssessmentAcknowledgementActorError,
  AssessmentLegalStatusUnknownError,
  InvalidGradeValueError,
  AuthorityDenied,
]);
export type AssessmentConfirmationError = typeof AssessmentConfirmationError.Type;

const checkWrittenRevision = (assessment: WrittenAssessment, expectedRevision: Revision) =>
  assessment.revision === expectedRevision
    ? Effect.void
    : Effect.fail(
        new ConcurrentWrittenAssessmentRevisionError({
          expected: expectedRevision,
          actual: assessment.revision,
        }),
      );

const checkStandingRevision = (standing: CourseStanding, expectedRevision: Revision) =>
  standing.revision === expectedRevision
    ? Effect.void
    : Effect.fail(
        new ConcurrentStandingRevisionError({
          expected: expectedRevision,
          actual: standing.revision,
        }),
      );

interface ConfirmationRecordInput {
  readonly actor: ActorRef;
  readonly acknowledgementId: AcknowledgementId;
  readonly acknowledgedAt: DateTime.Utc;
  readonly artifact?: ArtifactRef;
}

const makeAcknowledgement = (input: ConfirmationRecordInput, revision: Revision) => {
  const fields = {
    id: input.acknowledgementId,
    actor: input.actor,
    acknowledgedAt: input.acknowledgedAt,
    revision,
  };
  return input.artifact === undefined
    ? Acknowledgement.make(fields)
    : Acknowledgement.make({ ...fields, artifact: input.artifact });
};

const authorizeLearnerAcknowledgement = Effect.fn("Assessment.authorizeLearnerAcknowledgement")(
  function* (input: {
    readonly actor: ActorRef;
    readonly student: Person;
    readonly studentMembershipId: WrittenAssessment["studentMembershipId"];
    readonly on: CalendarDate;
    readonly legalAgePolicy: LegalAgePolicy;
    readonly authority: AuthoritySnapshot;
  }) {
    const studentMembership = input.authority.memberships.find(
      (membership) => membership.id === input.studentMembershipId,
    );
    if (studentMembership?.personId !== input.student.id) {
      return yield* new AssessmentAcknowledgementActorError({
        actor: input.actor,
        reason: "StudentIdentityMismatch",
      });
    }

    const legalStatus = legalStatusOn(input.student, input.on, input.legalAgePolicy);
    if (legalStatus === "Unknown") {
      return yield* new AssessmentLegalStatusUnknownError({
        studentId: input.student.id,
        on: input.on,
      });
    }
    const actorIsStudent = input.actor.personId === input.student.id;
    if (legalStatus === "Adult" && !actorIsStudent) {
      return yield* new AssessmentAcknowledgementActorError({
        actor: input.actor,
        reason: "AdultMustAcknowledgeSelf",
      });
    }
    if (legalStatus === "Minor" && actorIsStudent) {
      return yield* new AssessmentAcknowledgementActorError({
        actor: input.actor,
        reason: "GuardianRequired",
      });
    }
    yield* authorize(
      input.actor,
      actorIsStudent
        ? Capability.cases.ManageOwnNotebook.make({
            studentMembershipId: input.studentMembershipId,
          })
        : Capability.cases.AcknowledgeForStudent.make({
            studentMembershipId: input.studentMembershipId,
          }),
      input.on,
      input.authority,
    );
  },
);

export interface AttestWrittenAssessmentInput extends ConfirmationRecordInput {
  readonly assessment: WrittenAssessment;
  readonly expectedRevision: Revision;
  readonly authority: AuthoritySnapshot;
}

export const attestWrittenAssessment = Effect.fn("Assessment.attestWrittenAssessment")(function* (
  input: AttestWrittenAssessmentInput,
) {
  yield* checkWrittenRevision(input.assessment, input.expectedRevision);
  if (input.assessment.teacherAttestation !== undefined) {
    return yield* new AssessmentAlreadyTeacherAttestedError({ target: "WrittenAssessment" });
  }
  const policy = yield* GradingPolicy;
  yield* policy.validateValue(input.assessment.value);
  yield* authorize(
    input.actor,
    Capability.cases.ManageCourseOffering.make({
      courseOfferingId: input.assessment.courseOfferingId,
    }),
    input.assessment.assessedOn,
    input.authority,
  );
  return WrittenAssessment.make(
    Object.assign({}, input.assessment, {
      revision: Revision.make(input.assessment.revision + 1),
      teacherAttestation: makeAcknowledgement(input, input.assessment.revision),
    }),
  );
});

export interface AcknowledgeWrittenAssessmentInput extends ConfirmationRecordInput {
  readonly assessment: WrittenAssessment;
  readonly expectedRevision: Revision;
  readonly student: Person;
  readonly legalAgePolicy: LegalAgePolicy;
  readonly authority: AuthoritySnapshot;
}

export const acknowledgeWrittenAssessment = Effect.fn("Assessment.acknowledgeWrittenAssessment")(
  function* (input: AcknowledgeWrittenAssessmentInput) {
    yield* checkWrittenRevision(input.assessment, input.expectedRevision);
    if (input.assessment.learnerAcknowledgement !== undefined) {
      return yield* new AssessmentAlreadyLearnerAcknowledgedError({
        target: "WrittenAssessment",
      });
    }
    yield* authorizeLearnerAcknowledgement({
      actor: input.actor,
      student: input.student,
      studentMembershipId: input.assessment.studentMembershipId,
      on: input.assessment.assessedOn,
      legalAgePolicy: input.legalAgePolicy,
      authority: input.authority,
    });
    return WrittenAssessment.make(
      Object.assign({}, input.assessment, {
        revision: Revision.make(input.assessment.revision + 1),
        learnerAcknowledgement: makeAcknowledgement(input, input.assessment.revision),
      }),
    );
  },
);

export interface AddStandingRevisionInput {
  readonly standing: CourseStanding;
  readonly expectedRevision: Revision;
  readonly revision: StandingRevision;
}

export const addStandingRevision = Effect.fn("Assessment.addStandingRevision")(function* (
  input: AddStandingRevisionInput,
) {
  yield* checkStandingRevision(input.standing, input.expectedRevision);
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
  if (input.revision.observedOn < current.observedOn) {
    return yield* new StandingRevisionChronologyError({
      previousObservedOn: current.observedOn,
      nextObservedOn: input.revision.observedOn,
    });
  }

  const policy = yield* GradingPolicy;
  yield* policy.validateValue(input.revision.value);

  return CourseStanding.make(
    Object.assign({}, input.standing, {
      revision: Revision.make(input.standing.revision + 1),
      currentRevisionId: input.revision.id,
      revisions: [...input.standing.revisions, input.revision],
    }),
  );
});

interface StandingConfirmationInput extends ConfirmationRecordInput {
  readonly standing: CourseStanding;
  readonly expectedRevision: Revision;
  readonly revisionId: StandingRevisionId;
  readonly authority: AuthoritySnapshot;
}

const currentTarget = Effect.fn("Assessment.currentStandingTarget")(function* (
  input: StandingConfirmationInput,
) {
  yield* checkStandingRevision(input.standing, input.expectedRevision);
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
      revision: Revision.make(input.standing.revision + 1),
      revisions: [update(first), ...input.standing.revisions.slice(1).map(update)],
    }),
  );
};

export interface AttestStandingRevisionInput extends StandingConfirmationInput {}

export const attestStandingRevision = Effect.fn("Assessment.attestStandingRevision")(function* (
  input: AttestStandingRevisionInput,
) {
  const target = yield* currentTarget(input);
  if (target.teacherAttestation !== undefined) {
    return yield* new AssessmentAlreadyTeacherAttestedError({ target: "StandingRevision" });
  }
  const policy = yield* GradingPolicy;
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

export interface AcknowledgeStandingRevisionInput extends StandingConfirmationInput {
  readonly student: Person;
  readonly legalAgePolicy: LegalAgePolicy;
}

export const acknowledgeStandingRevision = Effect.fn("Assessment.acknowledgeStandingRevision")(
  function* (input: AcknowledgeStandingRevisionInput) {
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
  },
);
