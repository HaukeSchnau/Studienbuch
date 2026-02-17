import { z } from "zod";
import { SUBJECT_IDS } from "./courses";
import { SCHOOL_IDS, SEMESTER_TYPES, STATE_CODES } from "./school";
import { SALUTATIONS } from "./teacher";

export const SnapshotEntityKindSchema = z.enum(["student", "course"]);
export type SnapshotEntityKind = z.infer<typeof SnapshotEntityKindSchema>;

export const SnapshotEntityRefSchema = z.object({
  kind: SnapshotEntityKindSchema,
  id: z.string().uuid(),
});
export type SnapshotEntityRef = z.infer<typeof SnapshotEntityRefSchema>;

export const SnapshotRequestSchema = z.object({
  entities: z.array(SnapshotEntityRefSchema).min(1).max(32),
});
export type SnapshotRequest = z.infer<typeof SnapshotRequestSchema>;

export const SchoolSnapshotSchema = z.object({
  id: z.enum(SCHOOL_IDS),
  name: z.string(),
  stateCode: z.enum(STATE_CODES),
});
export type SchoolSnapshot = z.infer<typeof SchoolSnapshotSchema>;

export const YearSnapshotSchema = z.object({
  name: z.string(),
  startYear: z.number().int(),
  graduationYear: z.number().int(),
  school: z.enum(SCHOOL_IDS),
});
export type YearSnapshot = z.infer<typeof YearSnapshotSchema>;

export const ClassSnapshotSchema = z.object({
  identifierInYear: z.string(),
  startYear: z.number().int(),
  school: z.enum(SCHOOL_IDS),
});
export type ClassSnapshot = z.infer<typeof ClassSnapshotSchema>;

export const SemesterSnapshotSchema = z.object({
  name: z.string(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  school: z.enum(SCHOOL_IDS),
  type: z.enum(SEMESTER_TYPES),
  year: z.number().int(),
});
export type SemesterSnapshot = z.infer<typeof SemesterSnapshotSchema>;

export const StudentSnapshotSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  isOfAge: z.boolean(),
  school: SchoolSnapshotSchema,
  year: YearSnapshotSchema,
  class: ClassSnapshotSchema,
});
export type StudentSnapshot = z.infer<typeof StudentSnapshotSchema>;

export const CourseSnapshotSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  subject: z.enum(SUBJECT_IDS),
  isMandatory: z.boolean(),
  school: SchoolSnapshotSchema,
  semester: SemesterSnapshotSchema,
  teachers: z.array(
    z.object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string(),
      abbrv: z.string().nullable(),
      salutation: z.enum(SALUTATIONS).nullable(),
    }),
  ),
  classes: z.array(
    z.object({
      identifierInYear: z.string(),
      startYear: z.number().int(),
      school: z.enum(SCHOOL_IDS),
    }),
  ),
});
export type CourseSnapshot = z.infer<typeof CourseSnapshotSchema>;

export const SnapshotResponseSchema = z.object({
  students: z.array(StudentSnapshotSchema),
  courses: z.array(CourseSnapshotSchema),
});
export type SnapshotResponse = z.infer<typeof SnapshotResponseSchema>;
