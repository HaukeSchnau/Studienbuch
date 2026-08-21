import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import { CourseOffering } from "./course-offering";
import { CourseOfferingId, SchoolId, SchoolMembershipId } from "./identity";
import {
  GuardianRelationship,
  SchoolMembership,
  StudentMembership,
  TeachingAssignment,
} from "./membership";
import { ActorRef } from "./acknowledgement";

export const Capability = Schema.TaggedUnion({
  ManageSchoolDirectory: { schoolId: SchoolId },
  ManageOwnNotebook: { studentMembershipId: SchoolMembershipId },
  AcknowledgeForStudent: { studentMembershipId: SchoolMembershipId },
  ManageCourseOffering: { courseOfferingId: CourseOfferingId },
  DecideCourseAttendance: {
    studentMembershipId: SchoolMembershipId,
    courseOfferingId: CourseOfferingId,
  },
});
export type Capability = typeof Capability.Type;

const duplicateIssue = (
  field: string,
  items: ReadonlyArray<{ readonly id: string }>,
): Schema.FilterOutput => {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.id)) {
      return { path: [field, index, "id"], issue: `duplicate ${field} id ${item.id}` };
    }
    seen.add(item.id);
  }
  return true;
};

/**
 * A loaded authority slice, checked for referential coherence.
 *
 * Every branch reports which row failed and why. The whole check used to collapse into one
 * message, which is unusable when the snapshot is assembled from database rows: knowing the
 * snapshot is incoherent does not tell you which membership or relationship to look at.
 */
export const AuthoritySnapshot = Schema.Struct({
  memberships: Schema.Array(SchoolMembership),
  students: Schema.Array(StudentMembership),
  guardianRelationships: Schema.Array(GuardianRelationship),
  teachingAssignments: Schema.Array(TeachingAssignment),
  courseOfferings: Schema.Array(CourseOffering),
}).check(
  Schema.makeFilter((snapshot): Schema.FilterOutput => {
    for (const [field, items] of [
      ["memberships", snapshot.memberships],
      ["guardianRelationships", snapshot.guardianRelationships],
      ["teachingAssignments", snapshot.teachingAssignments],
      ["courseOfferings", snapshot.courseOfferings],
    ] as const) {
      const duplicate = duplicateIssue(field, items);
      if (duplicate !== true) return duplicate;
    }
    const studentIds = new Set<SchoolMembershipId>();
    for (const [index, student] of snapshot.students.entries()) {
      if (studentIds.has(student.membershipId)) {
        return {
          path: ["students", index, "membershipId"],
          issue: `duplicate student membership ${student.membershipId}`,
        };
      }
      studentIds.add(student.membershipId);
    }

    const membershipById = new Map(snapshot.memberships.map((item) => [item.id, item]));
    const offeringById = new Map(snapshot.courseOfferings.map((item) => [item.id, item]));

    for (const [index, student] of snapshot.students.entries()) {
      const membership = membershipById.get(student.membershipId);
      if (membership === undefined) {
        return {
          path: ["students", index, "membershipId"],
          issue: `no membership ${student.membershipId}`,
        };
      }
      if (!membership.roles.includes("Student")) {
        return {
          path: ["students", index, "membershipId"],
          issue: `membership ${student.membershipId} does not hold the Student role`,
        };
      }
    }

    for (const [index, relationship] of snapshot.guardianRelationships.entries()) {
      const student = membershipById.get(relationship.studentMembershipId);
      if (student === undefined || !student.roles.includes("Student")) {
        return {
          path: ["guardianRelationships", index, "studentMembershipId"],
          issue: `no student membership ${relationship.studentMembershipId}`,
        };
      }
      if (student.schoolId !== relationship.schoolId) {
        return {
          path: ["guardianRelationships", index, "schoolId"],
          issue: `student ${student.id} belongs to school ${student.schoolId}`,
        };
      }
      if (!CalendarDateRange.encloses(student.effective, relationship.effective)) {
        return {
          path: ["guardianRelationships", index, "effective"],
          issue: `outside the student membership's effective range`,
        };
      }
      const hasGuardianMembership = snapshot.memberships.some(
        (membership) =>
          membership.personId === relationship.guardianPersonId &&
          membership.schoolId === relationship.schoolId &&
          membership.roles.includes("Guardian") &&
          CalendarDateRange.encloses(membership.effective, relationship.effective),
      );
      if (!hasGuardianMembership) {
        return {
          path: ["guardianRelationships", index, "guardianPersonId"],
          issue: `no Guardian membership covering this relationship`,
        };
      }
    }

    for (const [index, assignment] of snapshot.teachingAssignments.entries()) {
      const teacher = membershipById.get(assignment.teacherMembershipId);
      if (teacher === undefined || !teacher.roles.includes("Teacher")) {
        return {
          path: ["teachingAssignments", index, "teacherMembershipId"],
          issue: `no Teacher membership ${assignment.teacherMembershipId}`,
        };
      }
      const offering = offeringById.get(assignment.courseOfferingId);
      if (offering === undefined) {
        return {
          path: ["teachingAssignments", index, "courseOfferingId"],
          issue: `no course offering ${assignment.courseOfferingId}`,
        };
      }
      if (teacher.schoolId !== offering.schoolId) {
        return {
          path: ["teachingAssignments", index, "courseOfferingId"],
          issue: `offering belongs to school ${offering.schoolId}, teacher to ${teacher.schoolId}`,
        };
      }
      if (!CalendarDateRange.encloses(teacher.effective, assignment.effective)) {
        return {
          path: ["teachingAssignments", index, "effective"],
          issue: `outside the teacher membership's effective range`,
        };
      }
    }

    return true;
  }),
);
export interface AuthoritySnapshot extends Schema.Schema.Type<typeof AuthoritySnapshot> {}

export class AuthorityDenied extends Schema.TaggedError<AuthorityDenied>()(
  "Organization.AuthorityDenied",
  {
    actor: ActorRef,
    capability: Capability,
    reason: Schema.Literals([
      "ActorMembershipMismatch",
      "ActorMembershipInactive",
      "TargetNotFound",
      "TargetInactive",
      "TargetOutsideSchool",
      "InsufficientRole",
      "GuardianRelationshipInactive",
      "TeacherNotAssigned",
    ]),
  },
) {}

const activeOn = (effective: CalendarDateRange.Type, on: PlainDate.Record) =>
  CalendarDateRange.contains(effective, on);

const deny = (actor: ActorRef, capability: Capability, reason: AuthorityDenied["reason"]) =>
  AuthorityDenied.make({ actor, capability, reason });

/**
 * Contextual authorization over a complete, already-loaded snapshot. It performs no IO and
 * treats both relationships and assignments as dated facts.
 */
export const authorize = Effect.fn("Organization.authorize")(function* (
  actor: ActorRef,
  capability: Capability,
  on: PlainDate.Record,
  snapshot: AuthoritySnapshot,
) {
  const actorMembership = snapshot.memberships.find(
    (membership) => membership.id === actor.schoolMembershipId,
  );
  if (actorMembership === undefined || actorMembership.personId !== actor.personId) {
    return yield* deny(actor, capability, "ActorMembershipMismatch");
  }
  if (!activeOn(actorMembership.effective, on)) {
    return yield* deny(actor, capability, "ActorMembershipInactive");
  }

  const studentSchool = (studentMembershipId: SchoolMembershipId) =>
    snapshot.students.some((student) => student.membershipId === studentMembershipId)
      ? snapshot.memberships.find((membership) => membership.id === studentMembershipId)
      : undefined;
  const offering = (courseOfferingId: CourseOfferingId) =>
    snapshot.courseOfferings.find((candidate) => candidate.id === courseOfferingId);
  const isAdministratorFor = (schoolId: SchoolId) =>
    actorMembership.schoolId === schoolId && actorMembership.roles.includes("Administrator");

  switch (capability._tag) {
    case "ManageSchoolDirectory":
      if (isAdministratorFor(capability.schoolId)) return;
      return yield* deny(actor, capability, "InsufficientRole");

    case "ManageOwnNotebook": {
      const student = studentSchool(capability.studentMembershipId);
      if (student === undefined) return yield* deny(actor, capability, "TargetNotFound");
      if (!activeOn(student.effective, on)) return yield* deny(actor, capability, "TargetInactive");
      if (student.schoolId !== actorMembership.schoolId) {
        return yield* deny(actor, capability, "TargetOutsideSchool");
      }
      if (student.id === actorMembership.id && actorMembership.roles.includes("Student")) return;
      if (isAdministratorFor(student.schoolId)) return;
      return yield* deny(actor, capability, "InsufficientRole");
    }

    case "AcknowledgeForStudent": {
      const student = studentSchool(capability.studentMembershipId);
      if (student === undefined) return yield* deny(actor, capability, "TargetNotFound");
      if (!activeOn(student.effective, on)) return yield* deny(actor, capability, "TargetInactive");
      if (student.schoolId !== actorMembership.schoolId) {
        return yield* deny(actor, capability, "TargetOutsideSchool");
      }
      const hasActiveRelationship = snapshot.guardianRelationships.some(
        (candidate) =>
          candidate.schoolId === student.schoolId &&
          candidate.guardianPersonId === actor.personId &&
          candidate.studentMembershipId === student.id &&
          candidate.authority !== "EmergencyContactOnly" &&
          activeOn(candidate.effective, on),
      );
      if (hasActiveRelationship) return;
      return yield* deny(actor, capability, "GuardianRelationshipInactive");
    }

    case "ManageCourseOffering": {
      const target = offering(capability.courseOfferingId);
      if (target === undefined) return yield* deny(actor, capability, "TargetNotFound");
      if (target.schoolId !== actorMembership.schoolId) {
        return yield* deny(actor, capability, "TargetOutsideSchool");
      }
      if (isAdministratorFor(target.schoolId)) return;
      const assigned =
        actorMembership.roles.includes("Teacher") &&
        snapshot.teachingAssignments.some(
          (assignment) =>
            assignment.teacherMembershipId === actorMembership.id &&
            assignment.courseOfferingId === target.id &&
            activeOn(assignment.effective, on),
        );
      if (assigned) return;
      return yield* deny(actor, capability, "TeacherNotAssigned");
    }

    case "DecideCourseAttendance": {
      const student = studentSchool(capability.studentMembershipId);
      const target = offering(capability.courseOfferingId);
      if (student === undefined || target === undefined) {
        return yield* deny(actor, capability, "TargetNotFound");
      }
      if (!activeOn(student.effective, on)) return yield* deny(actor, capability, "TargetInactive");
      if (student.schoolId !== target.schoolId || target.schoolId !== actorMembership.schoolId) {
        return yield* deny(actor, capability, "TargetOutsideSchool");
      }
      if (isAdministratorFor(target.schoolId)) return;
      const assigned =
        actorMembership.roles.includes("Teacher") &&
        snapshot.teachingAssignments.some(
          (assignment) =>
            assignment.teacherMembershipId === actorMembership.id &&
            assignment.courseOfferingId === target.id &&
            activeOn(assignment.effective, on),
        );
      if (assigned) return;
      return yield* deny(actor, capability, "TeacherNotAssigned");
    }
  }
});

export const may = (
  actor: ActorRef,
  capability: Capability,
  on: PlainDate.Record,
  snapshot: AuthoritySnapshot,
) => authorize(actor, capability, on, snapshot).pipe(Effect.isSuccess);
