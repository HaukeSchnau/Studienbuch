import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as CalendarDate from "../foundation/calendar-date";
import * as CalendarDateRange from "../foundation/calendar-date-range";
import * as NonBlankText from "../foundation/non-blank-text";
import { CourseOffering } from "./course-offering.ts";
import {
  AcademicTermId,
  CourseOfferingId,
  GuardianRelationshipId,
  PersonId,
  SchoolId,
  SchoolMembershipId,
  SubjectId,
  TeachingAssignmentId,
} from "./identity.ts";
import {
  ActorRef,
  AuthoritySnapshot,
  Capability,
  GuardianRelationship,
  LegalAgePolicy,
  Person,
  PersonName,
  SchoolMembership,
  StudentMembership,
  TeachingAssignment,
  authorize,
  legalStatusOn,
  requiresGuardianAcknowledgement,
} from "./index.ts";

const date = CalendarDate.unsafeFromString;
const interval = (start: string, end: string) =>
  CalendarDateRange.Schema.make({ start: date(start), end: date(end) });
const schoolId = SchoolId.make("school-1");
const studentMembershipId = SchoolMembershipId.make("student-membership");
const teacherMembershipId = SchoolMembershipId.make("teacher-membership");
const courseOfferingId = CourseOfferingId.make("course-1");

const membership = (
  id: SchoolMembershipId,
  personId: PersonId,
  roles: Parameters<typeof SchoolMembership.make>[0]["roles"],
) =>
  SchoolMembership.make({
    id,
    schoolId,
    personId,
    roles,
    effective: interval("2026-08-01", "2027-07-31"),
  });

const studentPersonId = PersonId.make("student-person");
const teacherPersonId = PersonId.make("teacher-person");
const guardianPersonId = PersonId.make("guardian-person");
const guardianMembershipId = SchoolMembershipId.make("guardian-membership");

const student = membership(studentMembershipId, studentPersonId, ["Student"]);
const teacher = membership(teacherMembershipId, teacherPersonId, ["Teacher"]);
const guardian = membership(guardianMembershipId, guardianPersonId, ["Guardian"]);
const studentDetails = StudentMembership.make({ membershipId: student.id, classGroupIds: [] });
const offering = CourseOffering.make({
  id: courseOfferingId,
  schoolId,
  termId: AcademicTermId.make("term-1"),
  subjectId: SubjectId.make("mathematics"),
  name: NonBlankText.unsafeFromString("Mathematics"),
  classGroupIds: [],
});

const snapshot = (overrides: Partial<AuthoritySnapshot> = {}) =>
  AuthoritySnapshot.make({
    memberships: [student, teacher, guardian],
    students: [studentDetails],
    guardianRelationships: [],
    teachingAssignments: [],
    courseOfferings: [offering],
    ...overrides,
  });

describe("legal status", () => {
  const person = Person.make({
    id: studentPersonId,
    name: PersonName.make({
      displayName: NonBlankText.unsafeFromString("Alex Example"),
      givenNames: [],
    }),
    dateOfBirth: date("2008-08-15"),
  });
  const policy = LegalAgePolicy.make({ ageOfMajority: 18, leapDayAnniversary: "March1" });

  it("evaluates age on the domain fact's date rather than using a stored isOfAge flag", () => {
    assert.strictEqual(legalStatusOn(person, date("2026-08-14"), policy), "Minor");
    assert.strictEqual(legalStatusOn(person, date("2026-08-15"), policy), "Adult");
    assert.isTrue(requiresGuardianAcknowledgement(person, date("2026-08-14"), policy));
    assert.isFalse(requiresGuardianAcknowledgement(person, date("2026-08-15"), policy));
  });

  it("applies the configured February 29 anniversary convention", () => {
    const leapBirthday = Person.make({ ...person, dateOfBirth: date("2008-02-29") });
    assert.strictEqual(legalStatusOn(leapBirthday, date("2026-02-28"), policy), "Minor");
    assert.strictEqual(legalStatusOn(leapBirthday, date("2026-03-01"), policy), "Adult");
    const februaryAnniversary = LegalAgePolicy.make({
      ageOfMajority: 18,
      leapDayAnniversary: "February28",
    });
    assert.strictEqual(
      legalStatusOn(leapBirthday, date("2026-02-28"), februaryAnniversary),
      "Adult",
    );
    const twentiethBirthday = LegalAgePolicy.make({
      ageOfMajority: 20,
      leapDayAnniversary: "March1",
    });
    assert.strictEqual(legalStatusOn(leapBirthday, date("2028-02-28"), twentiethBirthday), "Minor");
    assert.strictEqual(legalStatusOn(leapBirthday, date("2028-02-29"), twentiethBirthday), "Adult");
  });
});

describe("contextual authority", () => {
  const guardianActor = ActorRef.make({
    personId: guardianPersonId,
    schoolMembershipId: guardianMembershipId,
  });
  const teacherActor = ActorRef.make({
    personId: teacherPersonId,
    schoolMembershipId: teacherMembershipId,
  });
  const acknowledge = Capability.cases.AcknowledgeForStudent.make({ studentMembershipId });
  const decideAttendance = Capability.cases.DecideCourseAttendance.make({
    studentMembershipId,
    courseOfferingId,
  });

  it.effect("rejects a guardian whose relationship expired before the acknowledgement date", () =>
    Effect.gen(function* () {
      const relationship = GuardianRelationship.make({
        id: GuardianRelationshipId.make("guardian-relationship"),
        schoolId,
        guardianPersonId,
        studentMembershipId,
        authority: "AcknowledgementOnly",
        effective: interval("2026-08-01", "2026-08-10"),
      });
      const error = yield* Effect.flip(
        authorize(
          guardianActor,
          acknowledge,
          date("2026-08-14"),
          snapshot({ guardianRelationships: [relationship] }),
        ),
      );
      assert.strictEqual(error.reason, "GuardianRelationshipInactive");
    }),
  );

  it.effect("rejects an unrelated teacher and accepts the actively assigned teacher", () =>
    Effect.gen(function* () {
      const unrelated = yield* Effect.flip(
        authorize(teacherActor, decideAttendance, date("2026-08-14"), snapshot()),
      );
      assert.strictEqual(unrelated.reason, "TeacherNotAssigned");

      const assignment = TeachingAssignment.make({
        id: TeachingAssignmentId.make("assignment-1"),
        teacherMembershipId,
        courseOfferingId,
        effective: interval("2026-08-01", "2027-07-31"),
      });
      yield* authorize(
        teacherActor,
        decideAttendance,
        date("2026-08-14"),
        snapshot({ teachingAssignments: [assignment] }),
      );
    }),
  );

  it.effect("rejects duplicate authority identities at the boundary", () => {
    const encoded = Schema.encodeSync(AuthoritySnapshot)(snapshot());
    return Schema.decodeEffect(AuthoritySnapshot)({
      ...encoded,
      memberships: [
        encoded.memberships[0]!,
        { ...encoded.memberships[0]!, personId: "teacher-person" },
      ],
    }).pipe(Effect.flip);
  });

  it.effect("does not treat administrative authority as guardian evidence", () =>
    Effect.gen(function* () {
      const administrator = membership(
        SchoolMembershipId.make("administrator-membership"),
        PersonId.make("administrator-person"),
        ["Administrator"],
      );
      const error = yield* authorize(
        ActorRef.make({ personId: administrator.personId, schoolMembershipId: administrator.id }),
        acknowledge,
        date("2026-08-14"),
        snapshot({ memberships: [student, teacher, guardian, administrator] }),
      ).pipe(Effect.flip);
      assert.strictEqual(error.reason, "GuardianRelationshipInactive");
    }),
  );
});
