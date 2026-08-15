import { entityId } from "../internal/entity-id";

export const SchoolId = entityId("SchoolId");
export type SchoolId = typeof SchoolId.Type;

export const SubjectId = entityId("SubjectId");
export type SubjectId = typeof SubjectId.Type;

export const AcademicTermId = entityId("AcademicTermId");
export type AcademicTermId = typeof AcademicTermId.Type;

export const CohortId = entityId("CohortId");
export type CohortId = typeof CohortId.Type;

export const ClassGroupId = entityId("ClassGroupId");
export type ClassGroupId = typeof ClassGroupId.Type;

export const CourseOfferingId = entityId("CourseOfferingId");
export type CourseOfferingId = typeof CourseOfferingId.Type;

export const CourseChoiceGroupId = entityId("CourseChoiceGroupId");
export type CourseChoiceGroupId = typeof CourseChoiceGroupId.Type;

export const EnrollmentId = entityId("EnrollmentId");
export type EnrollmentId = typeof EnrollmentId.Type;

export const PersonId = entityId("PersonId");
export type PersonId = typeof PersonId.Type;

export const SchoolMembershipId = entityId("SchoolMembershipId");
export type SchoolMembershipId = typeof SchoolMembershipId.Type;

export const GuardianRelationshipId = entityId("GuardianRelationshipId");
export type GuardianRelationshipId = typeof GuardianRelationshipId.Type;

export const TeachingAssignmentId = entityId("TeachingAssignmentId");
export type TeachingAssignmentId = typeof TeachingAssignmentId.Type;

export const AcknowledgementId = entityId("AcknowledgementId");
export type AcknowledgementId = typeof AcknowledgementId.Type;
