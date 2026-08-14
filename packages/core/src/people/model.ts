import * as Schema from "effect/Schema";
import {
  AcknowledgementId,
  ArtifactRef,
  CalendarDate,
  ClassGroupId,
  CohortId,
  CourseOfferingId,
  DateInterval,
  GuardianRelationshipId,
  NonEmptyText,
  PersonId,
  Revision,
  SchoolId,
  SchoolMembershipId,
  TeachingAssignmentId,
} from "../primitives";

/**
 * `displayName` preserves the source/user-authored form. Structured components are optional
 * facts, never guessed by splitting the display name.
 */
export const PersonName = Schema.Struct({
  displayName: NonEmptyText,
  givenNames: Schema.Array(NonEmptyText),
  familyName: Schema.optionalKey(NonEmptyText),
  honorific: Schema.optionalKey(NonEmptyText),
});
export interface PersonName extends Schema.Schema.Type<typeof PersonName> {}

export const Person = Schema.Struct({
  id: PersonId,
  name: PersonName,
  dateOfBirth: Schema.optionalKey(CalendarDate),
});
export interface Person extends Schema.Schema.Type<typeof Person> {}

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

export const ActorRef = Schema.Struct({
  personId: PersonId,
  schoolMembershipId: SchoolMembershipId,
});
export interface ActorRef extends Schema.Schema.Type<typeof ActorRef> {}

export const Acknowledgement = Schema.Struct({
  id: AcknowledgementId,
  actor: ActorRef,
  acknowledgedAt: Schema.DateTimeUtcFromString,
  revision: Revision,
  artifact: Schema.optionalKey(ArtifactRef),
});
export interface Acknowledgement extends Schema.Schema.Type<typeof Acknowledgement> {}

export const LegalAgePolicy = Schema.Struct({
  ageOfMajority: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 30 })),
});
export interface LegalAgePolicy extends Schema.Schema.Type<typeof LegalAgePolicy> {}

export const LegalStatus = Schema.Literals(["Minor", "Adult", "Unknown"]);
export type LegalStatus = typeof LegalStatus.Type;

/** Evaluates legal status for an explicit date; it never reads the ambient clock. */
export const legalStatusOn = (
  person: Person,
  on: CalendarDate,
  policy: LegalAgePolicy,
): LegalStatus => {
  if (person.dateOfBirth === undefined) return "Unknown";
  const birthYear = Number(person.dateOfBirth.slice(0, 4));
  const birthMonth = Number(person.dateOfBirth.slice(5, 7));
  const birthDay = Number(person.dateOfBirth.slice(8, 10));
  const year = Number(on.slice(0, 4));
  const month = Number(on.slice(5, 7));
  const day = Number(on.slice(8, 10));
  const age =
    year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
  return age >= policy.ageOfMajority ? "Adult" : "Minor";
};

export const requiresGuardianAcknowledgement = (
  person: Person,
  on: CalendarDate,
  policy: LegalAgePolicy,
) => legalStatusOn(person, on, policy) !== "Adult";
