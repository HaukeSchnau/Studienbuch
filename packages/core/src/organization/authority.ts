import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CalendarDate } from "../foundation/calendar-date";
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

export const AuthoritySnapshot = Schema.Struct({
  memberships: Schema.Array(SchoolMembership),
  students: Schema.Array(StudentMembership),
  guardianRelationships: Schema.Array(GuardianRelationship),
  teachingAssignments: Schema.Array(TeachingAssignment),
  courseOfferings: Schema.Array(CourseOffering),
}).check(
  Schema.makeFilter(
    (snapshot) => {
      const unique = <Value extends string>(values: ReadonlyArray<Value>) =>
        new Set(values).size === values.length;
      if (
        !unique(snapshot.memberships.map((item) => item.id)) ||
        !unique(snapshot.students.map((item) => item.membershipId)) ||
        !unique(snapshot.guardianRelationships.map((item) => item.id)) ||
        !unique(snapshot.teachingAssignments.map((item) => item.id)) ||
        !unique(snapshot.courseOfferings.map((item) => item.id))
      ) {
        return false;
      }
      const membershipById = new Map(snapshot.memberships.map((item) => [item.id, item]));
      const offeringById = new Map(snapshot.courseOfferings.map((item) => [item.id, item]));
      if (
        snapshot.students.some((student) => {
          const membership = membershipById.get(student.membershipId);
          return membership === undefined || !membership.roles.includes("Student");
        })
      ) {
        return false;
      }
      if (
        snapshot.guardianRelationships.some((relationship) => {
          const student = membershipById.get(relationship.studentMembershipId);
          const hasGuardianMembership = snapshot.memberships.some(
            (membership) =>
              membership.personId === relationship.guardianPersonId &&
              membership.schoolId === relationship.schoolId &&
              membership.roles.includes("Guardian") &&
              CalendarDateRange.encloses(membership.effective, relationship.effective),
          );
          return (
            student === undefined ||
            !student.roles.includes("Student") ||
            student.schoolId !== relationship.schoolId ||
            !hasGuardianMembership ||
            !CalendarDateRange.encloses(student.effective, relationship.effective)
          );
        })
      ) {
        return false;
      }
      return snapshot.teachingAssignments.every((assignment) => {
        const teacher = membershipById.get(assignment.teacherMembershipId);
        const offering = offeringById.get(assignment.courseOfferingId);
        return (
          teacher !== undefined &&
          teacher.roles.includes("Teacher") &&
          offering !== undefined &&
          teacher.schoolId === offering.schoolId &&
          CalendarDateRange.encloses(teacher.effective, assignment.effective)
        );
      });
    },
    { expected: "a coherent, uniquely identified authority snapshot" },
  ),
);
export interface AuthoritySnapshot extends Schema.Schema.Type<typeof AuthoritySnapshot> {}

export class AuthorityDenied extends Schema.TaggedError<AuthorityDenied>()("AuthorityDenied", {
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
}) {}

const activeOn = (effective: CalendarDateRange.Type, on: CalendarDate.Type) =>
  CalendarDateRange.contains(effective, on);

const deny = (actor: ActorRef, capability: Capability, reason: AuthorityDenied["reason"]) =>
  new AuthorityDenied({ actor, capability, reason });

/**
 * Contextual authorization over a complete, already-loaded snapshot. It performs no IO and
 * treats both relationships and assignments as dated facts.
 */
export const authorize = Effect.fn("Organization.authorize")(function* (
  actor: ActorRef,
  capability: Capability,
  on: CalendarDate.Type,
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
  on: CalendarDate.Type,
  snapshot: AuthoritySnapshot,
) => authorize(actor, capability, on, snapshot).pipe(Effect.isSuccess);
