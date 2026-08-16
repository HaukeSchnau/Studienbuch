import * as Schema from "effect/Schema";
import { NonBlankText } from "../foundation/non-blank-text";
import {
  AcademicTermId,
  ClassGroupId,
  CohortId,
  CourseOfferingId,
  SchoolId,
  SubjectId,
} from "./identity";

export const ClassGroup = Schema.Struct({
  id: ClassGroupId,
  schoolId: SchoolId,
  termId: AcademicTermId,
  name: NonBlankText.Schema,
  cohortId: Schema.optionalKey(CohortId),
});
export interface ClassGroup extends Schema.Schema.Type<typeof ClassGroup> {}

export const CourseOffering = Schema.Struct({
  id: CourseOfferingId,
  schoolId: SchoolId,
  termId: AcademicTermId,
  subjectId: SubjectId,
  name: NonBlankText.Schema,
  classGroupIds: Schema.Array(ClassGroupId),
});
export interface CourseOffering extends Schema.Schema.Type<typeof CourseOffering> {}
