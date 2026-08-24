import * as Schema from "effect/Schema";
import { CalendarDateRange } from "../foundation/calendar-date-range";
import {
  AcademicYearId,
  ClassGroupId,
  CohortId,
  CourseOfferingId,
  DepartmentId,
  GuardianRelationshipId,
  PersonId,
  SchoolId,
  SchoolMembershipId,
  TeachingAssignmentId,
} from "./identity";

export const SchoolRole = Schema.Literals([
  "Student",
  "Guardian",
  "Teacher",
  "Administrator",
  "Staff",
]);
export type SchoolRole = typeof SchoolRole.Type;

export const SchoolMembership = Schema.Struct({
  id: SchoolMembershipId,
  schoolId: SchoolId,
  personId: PersonId,
  roles: Schema.NonEmptyArray(SchoolRole),
  effective: CalendarDateRange.Schema,
});
export interface SchoolMembership extends Schema.Schema.Type<typeof SchoolMembership> {}

export const StudentMembership = Schema.Struct({
  membershipId: SchoolMembershipId,
  cohortId: Schema.optional(CohortId),
});
export interface StudentMembership extends Schema.Schema.Type<typeof StudentMembership> {}

/** One dated assignment of a student membership to a lasting class group. */
export const StudentClassAssignment = Schema.Struct({
  studentMembershipId: SchoolMembershipId,
  classGroupId: ClassGroupId,
  effective: CalendarDateRange.Schema,
});
export interface StudentClassAssignment extends Schema.Schema.Type<typeof StudentClassAssignment> {}

/** An academic-year appointment as one of a class group's teachers. */
export const ClassTeacherAssignment = Schema.Struct({
  teacherMembershipId: SchoolMembershipId,
  classGroupId: ClassGroupId,
  academicYearId: AcademicYearId,
  position: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 2 })),
});
export interface ClassTeacherAssignment extends Schema.Schema.Type<typeof ClassTeacherAssignment> {}

/** A school-year-specific department association reported by the school directory. */
export const DepartmentAssignment = Schema.Struct({
  schoolMembershipId: SchoolMembershipId,
  departmentId: DepartmentId,
  academicYearId: AcademicYearId,
});
export interface DepartmentAssignment extends Schema.Schema.Type<typeof DepartmentAssignment> {}

export const GuardianAuthority = Schema.Literals([
  "Full",
  "AcknowledgementOnly",
  "EmergencyContactOnly",
]);
export type GuardianAuthority = typeof GuardianAuthority.Type;

export const GuardianRelationship = Schema.Struct({
  id: GuardianRelationshipId,
  schoolId: SchoolId,
  guardianPersonId: PersonId,
  studentMembershipId: SchoolMembershipId,
  authority: GuardianAuthority,
  effective: CalendarDateRange.Schema,
});
export interface GuardianRelationship extends Schema.Schema.Type<typeof GuardianRelationship> {}

export const TeachingAssignment = Schema.Struct({
  id: TeachingAssignmentId,
  teacherMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  effective: CalendarDateRange.Schema,
});
export interface TeachingAssignment extends Schema.Schema.Type<typeof TeachingAssignment> {}
