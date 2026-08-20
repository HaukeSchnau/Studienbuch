import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { AggregateRevision } from "../foundation/aggregate-revision";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { Attendance } from "../index.ts";
import { ActorRef } from "../organization/acknowledgement";
import { AuthoritySnapshot } from "../organization/authority";
import { CourseOffering } from "../organization/course-offering";
import { Enrollment, EnrollmentOrigin } from "../organization/enrollment";
import {
  AcademicTermId,
  AcknowledgementId,
  CourseOfferingId,
  EnrollmentId,
  GuardianRelationshipId,
  PersonId,
  SchoolId,
  SchoolMembershipId,
  SubjectId,
  TeachingAssignmentId,
} from "../organization/identity";
import {
  GuardianRelationship,
  SchoolMembership,
  StudentMembership,
  TeachingAssignment,
} from "../organization/membership";
import { LegalAgePolicy, Person, PersonName } from "../organization/person";
import { LessonOccurrenceId, RecurringMeetingId } from "../schedule/identity";
import { LessonOccurrence } from "../schedule/lesson-occurrence";
import { LocalTime } from "../schedule/local-time";
import { LocalTimeRange } from "../schedule/local-time-range";
import { AbsenceCaseId, MissedLessonId } from "./identity";

const date = (value: string) => PlainDate.fromString(value, Calendar.getBasic);
const schoolId = SchoolId.make("school");
const studentMembershipId = SchoolMembershipId.make("student-membership");
const guardianMembershipId = SchoolMembershipId.make("guardian-membership");
const teacherMembershipId = SchoolMembershipId.make("teacher-membership");
const studentPersonId = PersonId.make("student-person");
const guardianPersonId = PersonId.make("guardian-person");
const teacherPersonId = PersonId.make("teacher-person");
const occurrenceDate = date("2026-08-14");
const effective = CalendarDateRange.Schema.make({
  start: date("2026-08-01"),
  end: date("2027-07-31"),
});
const now = DateTime.makeUnsafe("2026-08-14T12:00:00Z");

const member = (
  id: SchoolMembershipId,
  personId: PersonId,
  role: "Student" | "Guardian" | "Teacher",
) => SchoolMembership.make({ id, schoolId, personId, roles: [role], effective });

const studentMember = member(studentMembershipId, studentPersonId, "Student");
const guardianMember = member(guardianMembershipId, guardianPersonId, "Guardian");
const teacherMember = member(teacherMembershipId, teacherPersonId, "Teacher");
const guardianActor = ActorRef.make({
  personId: guardianPersonId,
  schoolMembershipId: guardianMembershipId,
});
const teacherActor = ActorRef.make({
  personId: teacherPersonId,
  schoolMembershipId: teacherMembershipId,
});
const courseIds: readonly [CourseOfferingId, CourseOfferingId] = [
  CourseOfferingId.make("course-1"),
  CourseOfferingId.make("course-2"),
];
const lessonIds: readonly [MissedLessonId, MissedLessonId] = [
  MissedLessonId.make("lesson-1"),
  MissedLessonId.make("lesson-2"),
];
const occurrence = (courseOfferingId: CourseOfferingId, index: number) =>
  LessonOccurrence.make({
    id: LessonOccurrenceId.make(`occurrence-${index + 1}`),
    meetingId: RecurringMeetingId.make(`meeting-${index + 1}`),
    courseOfferingId,
    scheduledDate: date("2026-08-14"),
    date: date("2026-08-14"),
    timeRange: LocalTimeRange.Schema.make({
      start: LocalTime.Schema.make((8 + index) * 3_600_000),
      end: LocalTime.Schema.make((8 + index) * 3_600_000 + 45 * 60_000),
    }),
    teacherIds: [teacherPersonId],
    appliedExceptionIds: [],
  });
const occurrences: readonly [LessonOccurrence, LessonOccurrence] = [
  occurrence(courseIds[0], 0),
  occurrence(courseIds[1], 1),
];

const offerings = courseIds.map((id) =>
  CourseOffering.make({
    id,
    schoolId,
    termId: AcademicTermId.make("term"),
    subjectId: SubjectId.make(`subject-${id}`),
    name: `Course ${id}`,
    classGroupIds: [],
  }),
);
const enrollments = courseIds.map((courseOfferingId, index) =>
  Enrollment.make({
    id: EnrollmentId.make(`enrollment-${index + 1}`),
    studentMembershipId,
    courseOfferingId,
    effective,
    origin: EnrollmentOrigin.cases.Required.make({}),
  }),
);
const authority = AuthoritySnapshot.make({
  memberships: [studentMember, guardianMember, teacherMember],
  students: [StudentMembership.make({ membershipId: studentMembershipId, classGroupIds: [] })],
  guardianRelationships: [
    GuardianRelationship.make({
      id: GuardianRelationshipId.make("relationship"),
      schoolId,
      guardianPersonId,
      studentMembershipId,
      authority: "AcknowledgementOnly",
      effective,
    }),
  ],
  teachingAssignments: courseIds.map((courseOfferingId, index) =>
    TeachingAssignment.make({
      id: TeachingAssignmentId.make(`assignment-${index}`),
      teacherMembershipId,
      courseOfferingId,
      effective,
    }),
  ),
  courseOfferings: offerings,
});
const student = Person.make({
  id: studentPersonId,
  name: PersonName.make({ displayName: "Student", givenNames: [] }),
  dateOfBirth: date("2012-01-01"),
});
const absence = Attendance.AbsenceCase.make({
  id: AbsenceCaseId.make("absence"),
  studentMembershipId,
  date: occurrenceDate,
  reason: Attendance.AbsenceReason.cases.Illness.make({}),
  detailsRevision: AggregateRevision.initial,
  revision: AggregateRevision.initial,
  missedLessons: [
    Attendance.MissedLesson.make({
      id: lessonIds[0],
      lessonOccurrenceId: LessonOccurrenceId.make("occurrence-1"),
      courseOfferingId: courseIds[0],
      decision: Attendance.MissedLessonDecision.cases.Pending.make({}),
    }),
    Attendance.MissedLesson.make({
      id: lessonIds[1],
      lessonOccurrenceId: LessonOccurrenceId.make("occurrence-2"),
      courseOfferingId: courseIds[1],
      decision: Attendance.MissedLessonDecision.cases.Pending.make({}),
    }),
  ],
});

describe("attendance workflow", () => {
  it.effect("round-trips a nested absence through its wire schema", () =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encodeEffect(Attendance.AbsenceCase)(absence);
      assert.strictEqual(encoded.date, "2026-08-14");

      const decoded = yield* Schema.decodeEffect(Attendance.AbsenceCase)(encoded);
      assert.strictEqual(PlainDate.equals(decoded.date, absence.date), true);
      assert.deepEqual(yield* Schema.encodeEffect(Attendance.AbsenceCase)(decoded), encoded);
    }),
  );

  it.effect("models a two-lesson absence becoming partially and then mixed resolved", () =>
    Effect.gen(function* () {
      // These values were decoded independently, so matching must be structural.
      assert.notStrictEqual(absence.date, occurrences[0].date);
      assert.strictEqual(PlainDate.equals(absence.date, occurrences[0].date), true);

      const acknowledged = yield* Attendance.acknowledge({
        absence,
        expectedRevision: AggregateRevision.initial,
        actor: guardianActor,
        student,
        legalAgePolicy: LegalAgePolicy.make({
          ageOfMajority: 18,
          leapDayAnniversary: "March1",
        }),
        authority,
        acknowledgementId: AcknowledgementId.make("guardian-ack"),
        acknowledgedAt: now,
      });
      assert.deepEqual(Attendance.status(acknowledged), {
        _tag: "AwaitingLessonDecisions",
        pending: 2,
      });

      const partial = yield* Attendance.decideMissedLesson({
        absence: acknowledged,
        expectedRevision: AggregateRevision.Schema.make(1),
        missedLessonId: lessonIds[0],
        occurrence: occurrences[0],
        enrollments,
        actor: teacherActor,
        authority,
        decidedAt: now,
        decision: { _tag: "Excused", acknowledgementId: AcknowledgementId.make("teacher-ack") },
      });
      assert.deepEqual(Attendance.status(partial), {
        _tag: "PartiallyResolved",
        excused: 1,
        rejected: 0,
        pending: 1,
      });

      const resolved = yield* Attendance.decideMissedLesson({
        absence: partial,
        expectedRevision: AggregateRevision.Schema.make(2),
        missedLessonId: lessonIds[1],
        occurrence: occurrences[1],
        enrollments,
        actor: teacherActor,
        authority,
        decidedAt: now,
        decision: {
          _tag: "Rejected",
          reason: "Insufficient evidence",
        },
      });
      assert.deepEqual(Attendance.status(resolved), {
        _tag: "ResolvedMixed",
        excused: 1,
        rejected: 1,
      });

      const duplicate = yield* Effect.flip(
        Attendance.decideMissedLesson({
          absence: resolved,
          expectedRevision: AggregateRevision.Schema.make(3),
          missedLessonId: lessonIds[1],
          occurrence: occurrences[1],
          enrollments,
          actor: teacherActor,
          authority,
          decidedAt: now,
          decision: { _tag: "Rejected" },
        }),
      );
      assert.strictEqual(duplicate._tag, "Attendance.MissedLessonAlreadyDecided");
    }),
  );

  it.effect("refuses a stale concurrent acknowledgement", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        Attendance.acknowledge({
          absence,
          expectedRevision: AggregateRevision.Schema.make(1),
          actor: guardianActor,
          student,
          legalAgePolicy: LegalAgePolicy.make({
            ageOfMajority: 18,
            leapDayAnniversary: "March1",
          }),
          authority,
          acknowledgementId: AcknowledgementId.make("stale-ack"),
          acknowledgedAt: now,
        }),
      );
      assert.strictEqual(failure._tag, "Attendance.ConcurrentRevision");
    }),
  );

  it.effect("does not trust an unrelated person record for the legal-age decision", () =>
    Effect.gen(function* () {
      const unrelated = Person.make({
        id: PersonId.make("unrelated-minor"),
        name: PersonName.make({
          displayName: "Unrelated",
          givenNames: [],
        }),
        dateOfBirth: date("2015-01-01"),
      });
      const failure = yield* Effect.flip(
        Attendance.acknowledge({
          absence,
          expectedRevision: AggregateRevision.initial,
          actor: guardianActor,
          student: unrelated,
          legalAgePolicy: LegalAgePolicy.make({
            ageOfMajority: 18,
            leapDayAnniversary: "March1",
          }),
          authority,
          acknowledgementId: AcknowledgementId.make("forged-age-ack"),
          acknowledgedAt: now,
        }),
      );
      assert.strictEqual(failure._tag, "Attendance.StudentIdentity");
    }),
  );

  it.effect("refuses lesson decisions before the absence is acknowledged", () =>
    Effect.gen(function* () {
      const failure = yield* Attendance.decideMissedLesson({
        absence,
        expectedRevision: AggregateRevision.initial,
        missedLessonId: lessonIds[0],
        occurrence: occurrences[0],
        enrollments,
        actor: teacherActor,
        authority,
        decidedAt: now,
        decision: { _tag: "Rejected" },
      }).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "Attendance.AbsenceNotAcknowledged");
    }),
  );

  it.effect("rejects a forged occurrence and course pairing", () =>
    Effect.gen(function* () {
      const acknowledged = yield* Attendance.acknowledge({
        absence,
        expectedRevision: AggregateRevision.initial,
        actor: guardianActor,
        student,
        legalAgePolicy: LegalAgePolicy.make({
          ageOfMajority: 18,
          leapDayAnniversary: "March1",
        }),
        authority,
        acknowledgementId: AcknowledgementId.make("guardian-ack-for-forgery-test"),
        acknowledgedAt: now,
      });
      // oxlint-disable-next-line typescript/no-misused-spread
      const forged = LessonOccurrence.make({ ...occurrences[0], courseOfferingId: courseIds[1] });
      const failure = yield* Attendance.decideMissedLesson({
        absence: acknowledged,
        expectedRevision: AggregateRevision.Schema.make(1),
        missedLessonId: lessonIds[0],
        occurrence: forged,
        enrollments,
        actor: teacherActor,
        authority,
        decidedAt: now,
        decision: { _tag: "Rejected" },
      }).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "Attendance.MissedLessonOccurrenceMismatch");
    }),
  );
});
