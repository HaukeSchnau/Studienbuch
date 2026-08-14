import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { CourseOffering, Enrollment, EnrollmentOrigin } from "../../src/academics";
import {
  AbsenceCase,
  AbsenceReason,
  MissedLesson,
  MissedLessonDecision,
  absenceStatus,
  acknowledgeAbsenceCase,
  decideMissedLesson,
} from "../../src/attendance";
import {
  ActorRef,
  AuthoritySnapshot,
  GuardianRelationship,
  LegalAgePolicy,
  Person,
  PersonName,
  SchoolMembership,
  StudentMembership,
  TeachingAssignment,
} from "../../src/people";
import { LessonOccurrence } from "../../src/schedule";
import {
  AbsenceCaseId,
  AcademicTermId,
  AcknowledgementId,
  CalendarDate,
  CourseOfferingId,
  DateInterval,
  GuardianRelationshipId,
  EnrollmentId,
  LessonOccurrenceId,
  LocalTime,
  MissedLessonId,
  NonEmptyText,
  PersonId,
  Revision,
  RecurringMeetingId,
  SchoolId,
  SchoolMembershipId,
  SubjectId,
  TeachingAssignmentId,
  TimeRange,
} from "../../src/primitives";

const date = (value: string) => CalendarDate.make(value);
const schoolId = SchoolId.make("school");
const studentMembershipId = SchoolMembershipId.make("student-membership");
const guardianMembershipId = SchoolMembershipId.make("guardian-membership");
const teacherMembershipId = SchoolMembershipId.make("teacher-membership");
const studentPersonId = PersonId.make("student-person");
const guardianPersonId = PersonId.make("guardian-person");
const teacherPersonId = PersonId.make("teacher-person");
const occurrenceDate = date("2026-08-14");
const effective = DateInterval.make({ start: date("2026-08-01"), end: date("2027-07-31") });
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
    scheduledDate: occurrenceDate,
    date: occurrenceDate,
    timeRange: TimeRange.make({
      start: LocalTime.make(480 + index * 60),
      end: LocalTime.make(525 + index * 60),
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
    name: NonEmptyText.make(`Course ${id}`),
    classGroupIds: [],
    externalRefs: [],
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
  name: PersonName.make({ displayName: NonEmptyText.make("Student"), givenNames: [] }),
  dateOfBirth: date("2012-01-01"),
});
const absence = AbsenceCase.make({
  id: AbsenceCaseId.make("absence"),
  studentMembershipId,
  date: occurrenceDate,
  reason: AbsenceReason.cases.Illness.make({}),
  detailsRevision: Revision.make(0),
  revision: Revision.make(0),
  missedLessons: [
    MissedLesson.make({
      id: lessonIds[0],
      lessonOccurrenceId: LessonOccurrenceId.make("occurrence-1"),
      courseOfferingId: courseIds[0],
      decision: MissedLessonDecision.cases.Pending.make({}),
    }),
    MissedLesson.make({
      id: lessonIds[1],
      lessonOccurrenceId: LessonOccurrenceId.make("occurrence-2"),
      courseOfferingId: courseIds[1],
      decision: MissedLessonDecision.cases.Pending.make({}),
    }),
  ],
});

describe("attendance workflow", () => {
  it.effect("models a two-lesson absence becoming partially and then mixed resolved", () =>
    Effect.gen(function* () {
      const acknowledged = yield* acknowledgeAbsenceCase({
        absence,
        expectedRevision: Revision.make(0),
        actor: guardianActor,
        student,
        legalAgePolicy: LegalAgePolicy.make({ ageOfMajority: 18 }),
        authority,
        acknowledgementId: AcknowledgementId.make("guardian-ack"),
        acknowledgedAt: now,
      });
      assert.deepEqual(absenceStatus(acknowledged), {
        _tag: "AwaitingLessonDecisions",
        pending: 2,
      });

      const partial = yield* decideMissedLesson({
        absence: acknowledged,
        expectedRevision: Revision.make(1),
        missedLessonId: lessonIds[0],
        occurrence: occurrences[0],
        enrollments,
        actor: teacherActor,
        authority,
        decidedAt: now,
        decision: { _tag: "Excused", acknowledgementId: AcknowledgementId.make("teacher-ack") },
      });
      assert.deepEqual(absenceStatus(partial), {
        _tag: "PartiallyResolved",
        excused: 1,
        rejected: 0,
        pending: 1,
      });

      const resolved = yield* decideMissedLesson({
        absence: partial,
        expectedRevision: Revision.make(2),
        missedLessonId: lessonIds[1],
        occurrence: occurrences[1],
        enrollments,
        actor: teacherActor,
        authority,
        decidedAt: now,
        decision: { _tag: "Rejected", reason: NonEmptyText.make("Insufficient evidence") },
      });
      assert.deepEqual(absenceStatus(resolved), {
        _tag: "ResolvedMixed",
        excused: 1,
        rejected: 1,
      });

      const duplicate = yield* Effect.flip(
        decideMissedLesson({
          absence: resolved,
          expectedRevision: Revision.make(3),
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
        acknowledgeAbsenceCase({
          absence,
          expectedRevision: Revision.make(1),
          actor: guardianActor,
          student,
          legalAgePolicy: LegalAgePolicy.make({ ageOfMajority: 18 }),
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
        name: PersonName.make({ displayName: NonEmptyText.make("Unrelated"), givenNames: [] }),
        dateOfBirth: date("2015-01-01"),
      });
      const failure = yield* Effect.flip(
        acknowledgeAbsenceCase({
          absence,
          expectedRevision: Revision.make(0),
          actor: guardianActor,
          student: unrelated,
          legalAgePolicy: LegalAgePolicy.make({ ageOfMajority: 18 }),
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
      const failure = yield* decideMissedLesson({
        absence,
        expectedRevision: Revision.make(0),
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
      const acknowledged = yield* acknowledgeAbsenceCase({
        absence,
        expectedRevision: Revision.make(0),
        actor: guardianActor,
        student,
        legalAgePolicy: LegalAgePolicy.make({ ageOfMajority: 18 }),
        authority,
        acknowledgementId: AcknowledgementId.make("guardian-ack-for-forgery-test"),
        acknowledgedAt: now,
      });
      const forged = LessonOccurrence.make(
        Object.assign({}, occurrences[0], { courseOfferingId: courseIds[1] }),
      );
      const failure = yield* decideMissedLesson({
        absence: acknowledged,
        expectedRevision: Revision.make(1),
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
