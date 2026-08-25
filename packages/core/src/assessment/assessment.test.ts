import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Assessment } from "../index.ts";
import { AggregateRevision } from "../foundation/aggregate-revision.ts";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range.ts";
import { Acknowledgement, ActorRef } from "../organization/acknowledgement.ts";
import { AuthoritySnapshot } from "../organization/authority.ts";
import { CourseOffering } from "../organization/course-offering.ts";
import {
  AcknowledgementId,
  CourseOfferingId,
  PersonId,
  SchoolId,
  SchoolMembershipId,
} from "../organization/identity.ts";
import { SchoolMembership, StudentMembership } from "../organization/membership.ts";
import { LegalAgePolicy, Person, PersonName } from "../organization/person.ts";

const date = (value: string) => PlainDate.fromString(value, Calendar.getBasic);
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
const activeSchoolYear = CalendarDateRange.Schema.make({
  start: date("2026-08-01"),
  end: date("2027-07-31"),
});
const student = Person.make({
  id: studentPersonId,
  name: PersonName.make({ displayName: "Student", givenNames: [] }),
  dateOfBirth: date("2000-01-01"),
});
const courseOffering = CourseOffering.make({
  id: courseOfferingId,
  schoolId,
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
  students: [StudentMembership.make({ membershipId: studentMembershipId })],
  guardianRelationships: [],
  teachingAssignments: [],
  courseOfferings: [courseOffering],
});
const legalAgePolicy = LegalAgePolicy.make({
  ageOfMajority: 18,
  leapDayAnniversary: "March1",
});
const acknowledgement = (id: string, actor: ActorRef, revision: number) =>
  Acknowledgement.make({
    id: AcknowledgementId.make(id),
    actor,
    acknowledgedAt: at,
    revision: AggregateRevision.Schema.make(revision),
  });
const written = (id: string, value: number, confirmed: boolean) => {
  const fields = {
    id: Assessment.AssessmentId.make(id),
    studentMembershipId,
    courseOfferingId,
    assessedOn: date("2026-08-14"),
    value: Assessment.GradeValue.make(value),
    weight: Assessment.AssessmentWeight.make(1),
    revision: AggregateRevision.Schema.make(confirmed ? 2 : 0),
  };
  return confirmed
    ? Assessment.WrittenAssessment.make({
        ...fields,
        teacherAttestation: acknowledgement(`${id}-teacher`, teacherActor, 0),
        learnerAcknowledgement: acknowledgement(`${id}-learner`, studentActor, 1),
      })
    : Assessment.WrittenAssessment.make(fields);
};

describe("grading policy", () => {
  it.effect("includes only independently teacher-attested and learner-acknowledged grades", () =>
    Effect.gen(function* () {
      const provisional = written("provisional", 2, false);
      const empty = yield* Assessment.GradingPolicy.calculateAverage([
        Assessment.WrittenAssessment.make({
          ...provisional,
          teacherAttestation: acknowledgement("teacher-only", teacherActor, 0),
        }),
      ]);
      assert.isTrue(Option.isNone(empty));

      const average = yield* Assessment.GradingPolicy.calculateAverage([
        written("confirmed-a", 10, true),
        written("confirmed-b", 14, true),
        provisional,
      ]);
      assert.strictEqual(Option.getOrThrow(average).value, 12);
      assert.strictEqual(Option.getOrThrow(average).assessmentCount, 2);
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );

  it.effect("rejects a grade outside the configured 0-15 scale", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        Assessment.GradingPolicy.calculateAverage([written("invalid", 16, true)]),
      );
      assert.strictEqual(failure._tag, "Assessment.InvalidGradeValue");
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );

  it.effect("rejects mixed scope even when the conflicting grade is provisional", () =>
    Effect.gen(function* () {
      const provisional = written("other-student", 8, false);
      const failure = yield* Effect.flip(
        Assessment.GradingPolicy.calculateAverage([
          written("confirmed", 12, true),
          Assessment.WrittenAssessment.make({
            ...provisional,
            studentMembershipId: SchoolMembershipId.make("other-student"),
          }),
        ]),
      );
      if (failure._tag !== "Assessment.InvalidScope") {
        return assert.fail(`expected mixed scope, received ${failure._tag}`);
      }
      assert.strictEqual(failure.reason, "MixedStudents");
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );
});

describe("withdrawing a written assessment", () => {
  it.effect("retracts an unattested grade as a tombstone the average ignores", () =>
    Effect.gen(function* () {
      const withdrawn = yield* Assessment.withdrawWritten({
        assessment: written("to-withdraw", 12, false),
        expectedRevision: AggregateRevision.Schema.make(0),
        actor: studentActor,
        withdrawnAt: at,
        authority,
      });

      // The record stays: a peer that has not seen a hard delete would resurrect it on sync.
      assert.isTrue(Assessment.isWrittenWithdrawn(withdrawn));
      assert.isFalse(Assessment.isWrittenConfirmed(withdrawn));
      assert.strictEqual(withdrawn.revision, 1);

      const average = yield* Assessment.GradingPolicy.calculateAverage([
        withdrawn,
        written("kept", 10, true),
      ]);
      assert.isTrue(Option.isSome(average));
      if (Option.isSome(average)) assert.strictEqual(average.value.value, 10);
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );

  it.effect("refuses once a teacher has attested, and refuses twice over", () =>
    Effect.gen(function* () {
      const locked = yield* Assessment.withdrawWritten({
        assessment: written("attested", 12, true),
        expectedRevision: AggregateRevision.Schema.make(2),
        actor: studentActor,
        withdrawnAt: at,
        authority,
      }).pipe(Effect.flip);
      assert.strictEqual(locked._tag, "Assessment.WithdrawalLockedByAttestation");

      const once = yield* Assessment.withdrawWritten({
        assessment: written("twice", 12, false),
        expectedRevision: AggregateRevision.Schema.make(0),
        actor: studentActor,
        withdrawnAt: at,
        authority,
      });
      const again = yield* Assessment.withdrawWritten({
        assessment: once,
        expectedRevision: AggregateRevision.Schema.make(1),
        actor: studentActor,
        withdrawnAt: at,
        authority,
      }).pipe(Effect.flip);
      assert.strictEqual(again._tag, "Assessment.AlreadyWithdrawn");
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );
});

describe("written assessment confirmation", () => {
  it.effect("requires separate authorized, revision-safe teacher and learner records", () =>
    Effect.gen(function* () {
      const initial = written("written", 12, false);
      const attested = yield* Assessment.attestWritten({
        assessment: initial,
        expectedRevision: AggregateRevision.Schema.make(0),
        actor: teacherActor,
        authority,
        acknowledgementId: AcknowledgementId.make("written-teacher"),
        acknowledgedAt: at,
      });
      assert.isFalse(Assessment.isWrittenConfirmed(attested));
      const stale = yield* Effect.flip(
        Assessment.acknowledgeWritten({
          assessment: attested,
          expectedRevision: AggregateRevision.Schema.make(0),
          actor: studentActor,
          student,
          legalAgePolicy,
          authority,
          acknowledgementId: AcknowledgementId.make("stale"),
          acknowledgedAt: at,
        }),
      );
      assert.strictEqual(stale._tag, "AggregateRevision.Concurrent");

      const confirmed = yield* Assessment.acknowledgeWritten({
        assessment: attested,
        expectedRevision: AggregateRevision.Schema.make(1),
        actor: studentActor,
        student,
        legalAgePolicy,
        authority,
        acknowledgementId: AcknowledgementId.make("written-learner"),
        acknowledgedAt: at,
      });
      assert.isTrue(Assessment.isWrittenConfirmed(confirmed));
      assert.strictEqual(confirmed.revision, 2);
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );

  it.effect("refuses teacher attestation of an out-of-policy value", () =>
    Effect.gen(function* () {
      const failure = yield* Assessment.attestWritten({
        assessment: written("invalid-attestation", 16, false),
        expectedRevision: AggregateRevision.Schema.make(0),
        actor: teacherActor,
        authority,
        acknowledgementId: AcknowledgementId.make("invalid-teacher-attestation"),
        acknowledgedAt: at,
      }).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "Assessment.InvalidGradeValue");
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );

  it.effect("returns a distinct refusal when legal status cannot be established", () =>
    Effect.gen(function* () {
      const unknownAge = Person.make({
        id: studentPersonId,
        name: student.name,
      });
      const failure = yield* Effect.flip(
        Assessment.acknowledgeWritten({
          assessment: written("unknown-age", 10, false),
          expectedRevision: AggregateRevision.Schema.make(0),
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
  const root = Assessment.StandingRevision.make({
    id: Assessment.StandingRevisionId.make("standing-r1"),
    value: Assessment.GradeValue.make(10),
    observedOn: date("2026-08-01"),
    teacherAttestation: acknowledgement("standing-r1-teacher", teacherActor, 0),
    learnerAcknowledgement: acknowledgement("standing-r1-learner", studentActor, 1),
  });
  const standing = Assessment.CourseStanding.make({
    id: Assessment.CourseStandingId.make("standing"),
    studentMembershipId,
    courseOfferingId,
    kind: "Oral",
    revision: AggregateRevision.Schema.make(2),
    currentRevisionId: root.id,
    revisions: [root],
  });

  it.effect("restores the last confirmed revision by moving the pointer, keeping history", () =>
    Effect.gen(function* () {
      const pending = Assessment.StandingRevision.make({
        id: Assessment.StandingRevisionId.make("standing-r2"),
        value: Assessment.GradeValue.make(7),
        observedOn: date("2026-08-20"),
        supersedes: root.id,
      });
      const revised = yield* Assessment.reviseStanding({
        standing,
        expectedRevision: AggregateRevision.Schema.make(2),
        revision: pending,
      });
      assert.strictEqual(Assessment.currentStandingRevision(revised).id, pending.id);

      const restored = yield* Assessment.restoreLastConfirmedStanding({
        standing: revised,
        expectedRevision: revised.revision,
        actor: studentActor,
        authority,
      });

      assert.strictEqual(Assessment.currentStandingRevision(restored).id, root.id);
      // The abandoned revision is kept rather than deleted, so two devices can converge on it.
      assert.strictEqual(restored.revisions.length, 2);
      assert.isTrue(restored.revisions.some((entry) => entry.id === pending.id));
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );

  it.effect("refuses to restore when the current revision is already confirmed", () =>
    Effect.gen(function* () {
      const failure = yield* Assessment.restoreLastConfirmedStanding({
        standing,
        expectedRevision: AggregateRevision.Schema.make(2),
        actor: studentActor,
        authority,
      }).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "Assessment.StandingAlreadyConfirmed");
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );

  it.effect(
    "round-trips civil dates and nested acknowledgement revisions through the wire schema",
    () =>
      Effect.gen(function* () {
        const encoded = yield* Schema.encodeEffect(Assessment.CourseStanding)(standing);
        assert.strictEqual(encoded.revisions[0].observedOn, "2026-08-01");

        const decoded = yield* Schema.decodeEffect(Assessment.CourseStanding)(encoded);
        assert.strictEqual(PlainDate.toString(decoded.revisions[0].observedOn), "2026-08-01");
        assert.deepEqual(yield* Schema.encodeEffect(Assessment.CourseStanding)(decoded), encoded);

        yield* Effect.flip(
          Schema.decodeEffect(Assessment.CourseStanding)({
            ...encoded,
            revision: 0,
          }),
        );

        yield* Effect.flip(
          Schema.decodeEffect(Assessment.CourseStanding)({
            ...encoded,
            currentRevisionId: "standing-r2",
            revisions: [
              encoded.revisions[0],
              {
                id: "standing-r2",
                value: 12,
                observedOn: "2026-07-31",
                supersedes: encoded.revisions[0].id,
              },
            ],
          }),
        );
      }),
  );

  it("keeps assessment aggregate identities nominally distinct", () => {
    const assessmentId = Assessment.AssessmentId.make("assessment");
    // @ts-expect-error An assessment is not a course-standing aggregate.
    const standingId: Assessment.CourseStandingId = assessmentId;
    assert.strictEqual(standingId, "assessment");
  });

  it.effect(
    "retains the confirmed baseline until both confirmations exist on the new revision",
    () =>
      Effect.gen(function* () {
        const second = Assessment.StandingRevision.make({
          id: Assessment.StandingRevisionId.make("standing-r2"),
          value: Assessment.GradeValue.make(12),
          observedOn: date("2026-08-14"),
          supersedes: root.id,
        });
        const revised = yield* Assessment.reviseStanding({
          standing,
          expectedRevision: AggregateRevision.Schema.make(2),
          revision: second,
        });
        assert.strictEqual(Assessment.currentStandingRevision(revised).id, second.id);
        assert.strictEqual(
          Option.getOrThrow(Assessment.lastConfirmedStandingRevision(revised)).id,
          root.id,
        );

        const attested = yield* Assessment.attestStanding({
          standing: revised,
          expectedRevision: AggregateRevision.Schema.make(3),
          revisionId: second.id,
          actor: teacherActor,
          authority,
          acknowledgementId: AcknowledgementId.make("standing-r2-teacher"),
          acknowledgedAt: at,
        });
        assert.isFalse(
          Assessment.isStandingRevisionConfirmed(Assessment.currentStandingRevision(attested)),
        );
        const confirmed = yield* Assessment.acknowledgeStanding({
          standing: attested,
          expectedRevision: AggregateRevision.Schema.make(4),
          revisionId: second.id,
          actor: studentActor,
          student,
          legalAgePolicy,
          authority,
          acknowledgementId: AcknowledgementId.make("standing-r2-learner"),
          acknowledgedAt: at,
        });
        assert.isTrue(
          Assessment.isStandingRevisionConfirmed(Assessment.currentStandingRevision(confirmed)),
        );
      }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );

  it.effect("refuses branching, stale, backward-dated, and pre-confirmed revisions", () =>
    Effect.gen(function* () {
      const invalid = Assessment.StandingRevision.make({
        id: Assessment.StandingRevisionId.make("standing-invalid"),
        value: Assessment.GradeValue.make(11),
        observedOn: date("2026-07-31"),
        supersedes: root.id,
      });
      const chronology = yield* Effect.flip(
        Assessment.reviseStanding({
          standing,
          expectedRevision: AggregateRevision.Schema.make(2),
          revision: invalid,
        }),
      );
      assert.strictEqual(chronology._tag, "Assessment.StandingRevisionChronology");

      const stale = yield* Effect.flip(
        Assessment.reviseStanding({
          standing,
          expectedRevision: AggregateRevision.Schema.make(1),
          revision: invalid,
        }),
      );
      assert.strictEqual(stale._tag, "AggregateRevision.Concurrent");

      const injected = Assessment.StandingRevision.make({
        ...invalid,
        id: Assessment.StandingRevisionId.make("injected"),
        observedOn: date("2026-08-02"),
        teacherAttestation: acknowledgement("injected", teacherActor, 0),
      });
      const injection = yield* Effect.flip(
        Assessment.reviseStanding({
          standing,
          expectedRevision: AggregateRevision.Schema.make(2),
          revision: injected,
        }),
      );
      assert.strictEqual(injection._tag, "Assessment.AlreadyTeacherAttested");

      const branch = Assessment.StandingRevision.make({
        ...invalid,
        observedOn: date("2026-08-02"),
        supersedes: Assessment.StandingRevisionId.make("not-current"),
      });
      const branching = yield* Effect.flip(
        Assessment.reviseStanding({
          standing,
          expectedRevision: AggregateRevision.Schema.make(2),
          revision: branch,
        }),
      );
      assert.strictEqual(branching._tag, "Assessment.InvalidStandingSupersession");
    }).pipe(Effect.provide(Assessment.GradingPolicy.defaultLayer)),
  );
});
