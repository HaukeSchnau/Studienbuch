import * as Schema from "effect/Schema";
import {
  ClassGroupId,
  CohortId,
  CourseOfferingId,
  DateInterval,
  GuardianRelationshipId,
  PersonId,
  SchoolId,
  SchoolMembershipId,
  TeachingAssignmentId,
} from "../foundation";

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
  effective: DateInterval,
});
export interface SchoolMembership extends Schema.Schema.Type<typeof SchoolMembership> {}

export const StudentMembership = Schema.Struct({
  membershipId: SchoolMembershipId,
  cohortId: Schema.optionalKey(CohortId),
  classGroupIds: Schema.Array(ClassGroupId),
});
export interface StudentMembership extends Schema.Schema.Type<typeof StudentMembership> {}

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
  effective: DateInterval,
});
export interface GuardianRelationship extends Schema.Schema.Type<typeof GuardianRelationship> {}

export const TeachingAssignment = Schema.Struct({
  id: TeachingAssignmentId,
  teacherMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  effective: DateInterval,
});
export interface TeachingAssignment extends Schema.Schema.Type<typeof TeachingAssignment> {}
