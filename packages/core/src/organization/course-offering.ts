import * as Schema from "effect/Schema";
import {
  AcademicTermId,
  ClassGroupId,
  CohortId,
  CourseOfferingId,
  ExternalRef,
  NonEmptyText,
  SchoolId,
  SubjectId,
} from "../foundation";

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
