import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { CourseOffering } from "../../src/academics";
import {
  AssessmentWeight,
  CourseStanding,
  GradeValue,
  StandingRevision,
  WrittenAssessment,
  acknowledgeStandingRevision,
  acknowledgeWrittenAssessment,
  addStandingRevision,
  attestStandingRevision,
  attestWrittenAssessment,
  calculateAverage,
  currentStandingRevision,
  defaultGradingPolicyLayer,
  isStandingRevisionConfirmed,
  isWrittenAssessmentConfirmed,
  lastConfirmedStandingRevision,
} from "../../src/assessment";
import {
  Acknowledgement,
  ActorRef,
  AuthoritySnapshot,
  LegalAgePolicy,
  Person,
  PersonName,
  SchoolMembership,
  StudentMembership,
} from "../../src/people";
import {
  AcademicTermId,
  AcknowledgementId,
  AssessmentId,
  CalendarDate,
  CourseOfferingId,
  CourseStandingId,
  DateInterval,
  NonEmptyText,
  PersonId,
  Revision,
  SchoolId,
  SchoolMembershipId,
  StandingRevisionId,
  SubjectId,
} from "../../src/primitives";

const date = (value: string) => CalendarDate.make(value);
const schoolId = SchoolId.make("school");
const studentMembershipId = SchoolMembershipId.make("student");
const teacherMembershipId = SchoolMembershipId.make("teacher");
const courseOfferingId = CourseOfferingId.make("course");
const studentPersonId = PersonId.make("student-person");
const teacherPersonId = PersonId.make("teacher-person");
const studentActor = ActorRef.make({
  personId: studentPersonId,
  schoolMembershipId: studentMembershipId,
});
const teacherActor = ActorRef.make({
  personId: teacherPersonId,
  schoolMembershipId: teacherMembershipId,
});
const at = DateTime.makeUnsafe("2026-08-14T12:00:00Z");
const activeSchoolYear = DateInterval.make({
  start: date("2026-08-01"),
  end: date("2027-07-31"),
});
const student = Person.make({
  id: studentPersonId,
  name: PersonName.make({ displayName: NonEmptyText.make("Student"), givenNames: [] }),
  dateOfBirth: date("2000-01-01"),
});
const courseOffering = CourseOffering.make({
  id: courseOfferingId,
  schoolId,
  termId: AcademicTermId.make("term"),
  subjectId: SubjectId.make("subject"),
  name: NonEmptyText.make("Mathematics"),
  classGroupIds: [],
  externalRefs: [],
});
const authority = AuthoritySnapshot.make({
  memberships: [
    SchoolMembership.make({
      id: studentMembershipId,
      schoolId,
      personId: studentPersonId,
      roles: ["Student"],
      effective: activeSchoolYear,
    }),
    SchoolMembership.make({
      id: teacherMembershipId,
      schoolId,
      personId: teacherPersonId,
      roles: ["Administrator"],
      effective: activeSchoolYear,
    }),
  ],
  students: [StudentMembership.make({ membershipId: studentMembershipId, classGroupIds: [] })],
  guardianRelationships: [],
  teachingAssignments: [],
  courseOfferings: [courseOffering],
});
const legalAgePolicy = LegalAgePolicy.make({ ageOfMajority: 18 });
const acknowledgement = (id: string, actor: ActorRef, revision: number) =>
  Acknowledgement.make({
    id: AcknowledgementId.make(id),
    actor,
    acknowledgedAt: at,
    revision: Revision.make(revision),
  });
const written = (id: string, value: number, confirmed: boolean) => {
  const fields = {
    id: AssessmentId.make(id),
    studentMembershipId,
    courseOfferingId,
    assessedOn: date("2026-08-14"),
    value: GradeValue.make(value),
    weight: AssessmentWeight.make(1),
    revision: Revision.make(confirmed ? 2 : 0),
  };
  return confirmed
    ? WrittenAssessment.make({
        ...fields,
        teacherAttestation: acknowledgement(`${id}-teacher`, teacherActor, 0),
        learnerAcknowledgement: acknowledgement(`${id}-learner`, studentActor, 1),
      })
    : WrittenAssessment.make(fields);
};

describe("grading policy", () => {
  it.effect("includes only independently teacher-attested and learner-acknowledged grades", () =>
    Effect.gen(function* () {
      const provisional = written("provisional", 2, false);
      const empty = yield* calculateAverage([
        WrittenAssessment.make({
          ...provisional,
          teacherAttestation: acknowledgement("teacher-only", teacherActor, 0),
        }),
      ]);
      assert.isTrue(Option.isNone(empty));

      const average = yield* calculateAverage([
        written("confirmed-a", 10, true),
        written("confirmed-b", 14, true),
        provisional,
      ]);
      assert.strictEqual(Option.getOrThrow(average).value, 12);
      assert.strictEqual(Option.getOrThrow(average).assessmentCount, 2);
    }).pipe(Effect.provide(defaultGradingPolicyLayer)),
  );

  it.effect("rejects a grade outside the configured 0-15 scale", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(calculateAverage([written("invalid", 16, true)]));
      assert.strictEqual(failure._tag, "Assessment.InvalidGradeValue");
    }).pipe(Effect.provide(defaultGradingPolicyLayer)),
  );
});

describe("written assessment confirmation", () => {
  it.effect("requires separate authorized, revision-safe teacher and learner records", () =>
    Effect.gen(function* () {
      const initial = written("written", 12, false);
      const attested = yield* attestWrittenAssessment({
        assessment: initial,
        expectedRevision: Revision.make(0),
        actor: teacherActor,
        authority,
        acknowledgementId: AcknowledgementId.make("written-teacher"),
        acknowledgedAt: at,
      });
      assert.isFalse(isWrittenAssessmentConfirmed(attested));
      const stale = yield* Effect.flip(
        acknowledgeWrittenAssessment({
          assessment: attested,
          expectedRevision: Revision.make(0),
          actor: studentActor,
          student,
          legalAgePolicy,
          authority,
          acknowledgementId: AcknowledgementId.make("stale"),
          acknowledgedAt: at,
        }),
      );
      assert.strictEqual(stale._tag, "Assessment.ConcurrentWrittenAssessmentRevision");

      const confirmed = yield* acknowledgeWrittenAssessment({
        assessment: attested,
        expectedRevision: Revision.make(1),
        actor: studentActor,
        student,
        legalAgePolicy,
        authority,
        acknowledgementId: AcknowledgementId.make("written-learner"),
        acknowledgedAt: at,
      });
      assert.isTrue(isWrittenAssessmentConfirmed(confirmed));
      assert.strictEqual(confirmed.revision, 2);
    }).pipe(Effect.provide(defaultGradingPolicyLayer)),
  );

  it.effect("refuses teacher attestation of an out-of-policy value", () =>
    Effect.gen(function* () {
      const failure = yield* attestWrittenAssessment({
        assessment: written("invalid-attestation", 16, false),
        expectedRevision: Revision.make(0),
        actor: teacherActor,
        authority,
        acknowledgementId: AcknowledgementId.make("invalid-teacher-attestation"),
        acknowledgedAt: at,
      }).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "Assessment.InvalidGradeValue");
    }).pipe(Effect.provide(defaultGradingPolicyLayer)),
  );

  it.effect("returns a distinct refusal when legal status cannot be established", () =>
    Effect.gen(function* () {
      const unknownAge = Person.make({
        id: studentPersonId,
        name: student.name,
      });
      const failure = yield* Effect.flip(
        acknowledgeWrittenAssessment({
          assessment: written("unknown-age", 10, false),
          expectedRevision: Revision.make(0),
          actor: studentActor,
          student: unknownAge,
          legalAgePolicy,
          authority,
          acknowledgementId: AcknowledgementId.make("unknown-age"),
          acknowledgedAt: at,
        }),
      );
      assert.strictEqual(failure._tag, "Assessment.LegalStatusUnknown");
    }),
  );
});

describe("standing revisions", () => {
  const root = StandingRevision.make({
    id: StandingRevisionId.make("standing-r1"),
    value: GradeValue.make(10),
    observedOn: date("2026-08-01"),
    teacherAttestation: acknowledgement("standing-r1-teacher", teacherActor, 0),
    learnerAcknowledgement: acknowledgement("standing-r1-learner", studentActor, 1),
  });
  const standing = CourseStanding.make({
    id: CourseStandingId.make("standing"),
    studentMembershipId,
    courseOfferingId,
    kind: "Oral",
    revision: Revision.make(2),
    currentRevisionId: root.id,
    revisions: [root],
  });

  it.effect(
    "retains the confirmed baseline until both confirmations exist on the new revision",
    () =>
      Effect.gen(function* () {
        const second = StandingRevision.make({
          id: StandingRevisionId.make("standing-r2"),
          value: GradeValue.make(12),
          observedOn: date("2026-08-14"),
          supersedes: root.id,
        });
        const revised = yield* addStandingRevision({
          standing,
          expectedRevision: Revision.make(2),
          revision: second,
        });
        assert.strictEqual(Option.getOrThrow(currentStandingRevision(revised)).id, second.id);
        assert.strictEqual(Option.getOrThrow(lastConfirmedStandingRevision(revised)).id, root.id);

        const attested = yield* attestStandingRevision({
          standing: revised,
          expectedRevision: Revision.make(3),
          revisionId: second.id,
          actor: teacherActor,
          authority,
          acknowledgementId: AcknowledgementId.make("standing-r2-teacher"),
          acknowledgedAt: at,
        });
        assert.isFalse(
          isStandingRevisionConfirmed(Option.getOrThrow(currentStandingRevision(attested))),
        );
        const confirmed = yield* acknowledgeStandingRevision({
          standing: attested,
          expectedRevision: Revision.make(4),
          revisionId: second.id,
          actor: studentActor,
          student,
          legalAgePolicy,
          authority,
          acknowledgementId: AcknowledgementId.make("standing-r2-learner"),
          acknowledgedAt: at,
        });
        assert.isTrue(
          isStandingRevisionConfirmed(Option.getOrThrow(currentStandingRevision(confirmed))),
        );
      }).pipe(Effect.provide(defaultGradingPolicyLayer)),
  );

  it.effect("refuses branching, stale, backward-dated, and pre-confirmed revisions", () =>
    Effect.gen(function* () {
      const invalid = StandingRevision.make({
        id: StandingRevisionId.make("standing-invalid"),
        value: GradeValue.make(11),
        observedOn: date("2026-07-31"),
        supersedes: root.id,
      });
      const chronology = yield* Effect.flip(
        addStandingRevision({ standing, expectedRevision: Revision.make(2), revision: invalid }),
      );
      assert.strictEqual(chronology._tag, "Assessment.StandingRevisionChronology");

      const stale = yield* Effect.flip(
        addStandingRevision({ standing, expectedRevision: Revision.make(1), revision: invalid }),
      );
      assert.strictEqual(stale._tag, "Assessment.ConcurrentStandingRevision");

      const injected = StandingRevision.make({
        ...invalid,
        id: StandingRevisionId.make("injected"),
        observedOn: date("2026-08-02"),
        teacherAttestation: acknowledgement("injected", teacherActor, 0),
      });
      const injection = yield* Effect.flip(
        addStandingRevision({ standing, expectedRevision: Revision.make(2), revision: injected }),
      );
      assert.strictEqual(injection._tag, "Assessment.AlreadyTeacherAttested");

      const branch = StandingRevision.make({
        ...invalid,
        observedOn: date("2026-08-02"),
        supersedes: StandingRevisionId.make("not-current"),
      });
      const branching = yield* Effect.flip(
        addStandingRevision({ standing, expectedRevision: Revision.make(2), revision: branch }),
      );
      assert.strictEqual(branching._tag, "Assessment.InvalidStandingSupersession");
    }).pipe(Effect.provide(defaultGradingPolicyLayer)),
  );
});
