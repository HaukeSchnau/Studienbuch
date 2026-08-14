import * as Schema from "effect/Schema";
import {
  AcademicTermId,
  CalendarDate,
  ClassGroupId,
  CohortId,
  CourseChoiceGroupId,
  CourseOfferingId,
  DateInterval,
  EnrollmentId,
  ExternalRef,
  NonEmptyText,
  SchoolId,
  SchoolMembershipId,
  SubjectId,
} from "../primitives";

export const GradeLevel = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 20 })).pipe(
  Schema.brand("GradeLevel"),
);
export type GradeLevel = typeof GradeLevel.Type;

export const School = Schema.Struct({
  id: SchoolId,
  name: NonEmptyText,
});
export interface School extends Schema.Schema.Type<typeof School> {}

export const Subject = Schema.Struct({
  id: SubjectId,
  schoolId: SchoolId,
  name: NonEmptyText,
  code: Schema.optionalKey(NonEmptyText),
  aliases: Schema.Array(NonEmptyText),
  externalRefs: Schema.Array(ExternalRef),
});
export interface Subject extends Schema.Schema.Type<typeof Subject> {}

export const SubjectCatalog = Schema.Struct({
  schoolId: SchoolId,
  subjects: Schema.Array(Subject),
}).check(
  Schema.makeFilter(
    ({ schoolId, subjects }) =>
      subjects.every((subject) => subject.schoolId === schoolId) &&
      new Set(subjects.map((subject) => subject.id)).size === subjects.length,
    { expected: "a catalog of uniquely identified subjects belonging to its school" },
  ),
);
export interface SubjectCatalog extends Schema.Schema.Type<typeof SubjectCatalog> {}

export const AcademicTerm = Schema.Struct({
  id: AcademicTermId,
  schoolId: SchoolId,
  name: NonEmptyText,
  interval: DateInterval,
});
export interface AcademicTerm extends Schema.Schema.Type<typeof AcademicTerm> {}

export const Cohort = Schema.Struct({
  id: CohortId,
  schoolId: SchoolId,
  name: NonEmptyText,
  entryTermId: AcademicTermId,
  entryGradeLevel: GradeLevel,
});
export interface Cohort extends Schema.Schema.Type<typeof Cohort> {}

export const CohortProgressionPolicy = Schema.Struct({
  termsPerGradeLevel: Schema.Int.check(Schema.isGreaterThan(0)),
  maximumGradeLevel: GradeLevel,
});
export interface CohortProgressionPolicy extends Schema.Schema.Type<
  typeof CohortProgressionPolicy
> {}

export const ClassGroup = Schema.Struct({
  id: ClassGroupId,
  schoolId: SchoolId,
  termId: AcademicTermId,
  name: NonEmptyText,
  cohortId: Schema.optionalKey(CohortId),
});
export interface ClassGroup extends Schema.Schema.Type<typeof ClassGroup> {}

export const CourseOffering = Schema.Struct({
  id: CourseOfferingId,
  schoolId: SchoolId,
  termId: AcademicTermId,
  subjectId: SubjectId,
  name: NonEmptyText,
  classGroupIds: Schema.Array(ClassGroupId),
  externalRefs: Schema.Array(ExternalRef),
});
export interface CourseOffering extends Schema.Schema.Type<typeof CourseOffering> {}

export const EnrollmentOrigin = Schema.TaggedUnion({
  InheritedFromClass: { classGroupId: ClassGroupId },
  Required: {},
  Choice: { choiceGroupId: CourseChoiceGroupId },
  Optional: {},
});
export type EnrollmentOrigin = typeof EnrollmentOrigin.Type;

export const Enrollment = Schema.Struct({
  id: EnrollmentId,
  studentMembershipId: SchoolMembershipId,
  courseOfferingId: CourseOfferingId,
  effective: DateInterval,
  origin: EnrollmentOrigin,
});
export interface Enrollment extends Schema.Schema.Type<typeof Enrollment> {}

export const SelectionCardinality = Schema.Struct({
  minimum: Schema.Natural,
  maximum: Schema.Natural,
}).check(
  Schema.makeFilter(({ minimum, maximum }) => minimum <= maximum, {
    expected: "a selection cardinality whose minimum is not greater than its maximum",
  }),
);
export interface SelectionCardinality extends Schema.Schema.Type<typeof SelectionCardinality> {}

export const CourseChoiceGroup = Schema.Struct({
  id: CourseChoiceGroupId,
  schoolId: SchoolId,
  termId: AcademicTermId,
  name: NonEmptyText,
  offeringIds: Schema.NonEmptyArray(CourseOfferingId),
  cardinality: SelectionCardinality,
}).check(
  Schema.makeFilter(
    ({ offeringIds, cardinality }) =>
      new Set(offeringIds).size === offeringIds.length && cardinality.maximum <= offeringIds.length,
    {
      expected:
        "a course choice group with unique offerings and a maximum no larger than its alternatives",
    },
  ),
);
export interface CourseChoiceGroup extends Schema.Schema.Type<typeof CourseChoiceGroup> {}

export const EnrollmentSuggestion = Schema.Struct({
  previousEnrollmentId: EnrollmentId,
  previousOfferingId: CourseOfferingId,
  suggestedOfferingId: CourseOfferingId,
  reason: Schema.Literal("SameSubjectInNextTerm"),
});
export interface EnrollmentSuggestion extends Schema.Schema.Type<typeof EnrollmentSuggestion> {}

/** A complete school-scoped directory slice suitable for cross-entity validation. */
export const AcademicStructure = Schema.Struct({
  school: School,
  subjectCatalog: SubjectCatalog,
  terms: Schema.Array(AcademicTerm),
  cohorts: Schema.Array(Cohort),
  classGroups: Schema.Array(ClassGroup),
  courseOfferings: Schema.Array(CourseOffering),
  choiceGroups: Schema.Array(CourseChoiceGroup),
  enrollments: Schema.Array(Enrollment),
});
export interface AcademicStructure extends Schema.Schema.Type<typeof AcademicStructure> {}

/** Returns a catalog subject only when both identity and school scope match. */
export const findSubject = (catalog: SubjectCatalog, subjectId: SubjectId): Subject | undefined =>
  catalog.subjects.find(
    (subject) => subject.id === subjectId && subject.schoolId === catalog.schoolId,
  );

/** Effective intervals are closed; both boundary dates participate in the enrollment. */
export const isEnrollmentEffectiveOn = (enrollment: Enrollment, date: CalendarDate) =>
  enrollment.effective.start <= date && date <= enrollment.effective.end;
