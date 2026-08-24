import * as Schema from "effect/Schema";
import { NonBlankText } from "../foundation/non-blank-text";
import { GradeLevel } from "./academic-year";
import {
  AcademicTermId,
  AcademicYearId,
  ClassGroupId,
  CohortId,
  CourseOfferingId,
  DepartmentId,
  SchoolId,
  SubjectId,
} from "./identity";

export const ClassGroup = Schema.Struct({
  id: ClassGroupId,
  schoolId: SchoolId,
  cohortId: Schema.optional(CohortId),
});
export interface ClassGroup extends Schema.Schema.Type<typeof ClassGroup> {}

/** The school-year name of one lasting class, such as `5.2` before it becomes `6.2`. */
export const ClassGroupAcademicYear = Schema.Struct({
  classGroupId: ClassGroupId,
  academicYearId: AcademicYearId,
  name: NonBlankText,
  gradeLevel: Schema.optional(GradeLevel),
  departmentId: Schema.optional(DepartmentId),
});
export interface ClassGroupAcademicYear extends Schema.Schema.Type<typeof ClassGroupAcademicYear> {}

export const CourseOffering = Schema.Struct({
  id: CourseOfferingId,
  schoolId: SchoolId,
  termId: AcademicTermId,
  subjectId: SubjectId,
  name: NonBlankText,
  classGroupIds: Schema.Array(ClassGroupId),
});
export interface CourseOffering extends Schema.Schema.Type<typeof CourseOffering> {}
