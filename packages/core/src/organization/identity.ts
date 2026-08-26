import * as Schema from "effect/Schema";
import { entityId } from "../internal/entity-id";

/**
 * The one school identifier no school may take.
 *
 * The application shell spells a person's context as a path: `/app/{schoolId}/{kind}` for a school,
 * `/app/operator` for the platform operator. Without this reservation `/app/operator/schueler` reads
 * equally well as "a school called operator", and the two contexts become impossible to tell apart
 * from a link alone.
 */
export const reservedSchoolId = "operator";

/**
 * A school's stable identifier, which is also a path segment.
 *
 * An operator chooses it when generating a school's first code batch, and it then appears in every
 * link into that school — so it has to survive being typed, shared and read aloud. A slug is the
 * constraint that makes that true.
 */
export const SchoolId = entityId("SchoolId").pipe(
  Schema.check(
    Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    Schema.makeFilter((value): Schema.FilterOutput =>
      value === reservedSchoolId
        ? `${reservedSchoolId} is reserved for the operator context`
        : true,
    ),
  ),
);
export type SchoolId = typeof SchoolId.Type;

export const SubjectId = entityId("SubjectId");
export type SubjectId = typeof SubjectId.Type;

export const AcademicYearId = entityId("AcademicYearId");
export type AcademicYearId = typeof AcademicYearId.Type;

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

export const DepartmentId = entityId("DepartmentId");
export type DepartmentId = typeof DepartmentId.Type;

export const BuildingId = entityId("BuildingId");
export type BuildingId = typeof BuildingId.Type;

export const RoomId = entityId("RoomId");
export type RoomId = typeof RoomId.Type;

export const AcknowledgementId = entityId("AcknowledgementId");
export type AcknowledgementId = typeof AcknowledgementId.Type;
