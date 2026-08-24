import { Organization } from "@stu/core";
import * as Schema from "effect/Schema";

/** A WebUntis activity retained before it resolves to a subject or course offering. */
export const ProviderActivity = Schema.Struct({
  id: Schema.String,
  schoolId: Organization.SchoolId,
  shortName: Schema.String,
  longName: Schema.String,
  displayName: Schema.String,
  departmentIds: Schema.Array(Organization.DepartmentId),
});
export interface ProviderActivity extends Schema.Schema.Type<typeof ProviderActivity> {}

const common = {
  id: Schema.String,
  schoolId: Organization.SchoolId,
} as const;

/** One schema-validated entity in the canonical, server-only school-directory read model. */
export const DirectoryEntity = Schema.TaggedUnion({
  School: { ...common, value: Organization.School },
  AcademicYear: { ...common, value: Organization.AcademicYear },
  Cohort: { ...common, value: Organization.Cohort },
  Department: { ...common, value: Organization.Department },
  Building: { ...common, value: Organization.Building },
  Room: { ...common, value: Organization.Room },
  Person: { ...common, value: Organization.Person },
  SchoolMembership: { ...common, value: Organization.SchoolMembership },
  StudentMembership: { ...common, value: Organization.StudentMembership },
  StudentClassAssignment: { ...common, value: Organization.StudentClassAssignment },
  ClassTeacherAssignment: { ...common, value: Organization.ClassTeacherAssignment },
  DepartmentAssignment: { ...common, value: Organization.DepartmentAssignment },
  ClassGroup: { ...common, value: Organization.ClassGroup },
  ClassGroupAcademicYear: { ...common, value: Organization.ClassGroupAcademicYear },
  ProviderActivity: { ...common, value: ProviderActivity },
});
export type DirectoryEntity = typeof DirectoryEntity.Type;

export const directoryEntityKey = (input: {
  readonly dataSourceId: string;
  readonly entityKind: DirectoryEntity["_tag"];
  readonly entityId: string;
}) => JSON.stringify([input.dataSourceId, input.entityKind, input.entityId]);
