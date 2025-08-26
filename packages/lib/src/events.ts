import { createEventUnion, createDomainEvent as event } from "@groundswell/zod-helpers";
import { array, boolean, date, number, object, string, z } from "zod";
import { SUBJECT_IDS } from "./courses";
import { GRADE_TYPES } from "./grades";
import { simpleDateSchema } from "./infrastructure/dates";
import type { SchoolId, StateCode } from "./school";
import { SCHOOL_IDS, SEMESTER_TYPES, STATE_CODES } from "./school";
import { SALUTATIONS } from "./teacher";

export const DomainEvent = createEventUnion([
  event("absence.recorded", {
    date: date(),
    reason: string(),
    courseIds: array(string().uuid()).min(1),
  }),
  event("absence.parentApproved", {
    date: date(),
    signature: string(),
  }),
  event("absence.teacherApproved", {
    date: date(),
    courseId: string().uuid(),
    signature: string(),
  }),
  event("absence.discarded", {
    date: date(),
    courseIds: array(string().uuid()),
  }),
  event("grades.currentGradeSet", {
    courseId: string().uuid(),
    date: date(),
    result: number(),
    type: z.enum(GRADE_TYPES),
  }),
  event("grades.writtenGradeRecorded", {
    courseId: string(),
    date: date(),
    result: number(),
  }),
  event("grades.teacherApproved", {
    date: date(),
    course: string(),
    type: z.enum(GRADE_TYPES),
    signature: string(),
  }),
  event("grades.parentApproved", {
    date: date(),
    course: string().uuid(),
    type: z.enum(GRADE_TYPES),
    signature: string(),
  }),
  event("grades.discarded", {
    course: string().uuid(),
    type: z.enum(GRADE_TYPES),
    date: date(),
  }),
  event("grades.latestRestored", {
    course: string().uuid(),
    type: z.enum(GRADE_TYPES),
  }),
  event("org.school.founded", {
    id: z.enum(SCHOOL_IDS),
    name: string(),
    state: z.enum(STATE_CODES),
  }),
  event("org.year.started", {
    name: string(),
    startYear: number(),
    graduationYear: number(),
    school: z.enum(SCHOOL_IDS),
    classes: array(
      z.object({
        identifierInYear: string(),
        teachers: array(string().uuid()),
      }),
    ),
  }),
  event("org.teacher.joined", {
    personId: string().uuid(),
    firstName: string().optional(),
    lastName: string().optional(),
    abbrv: string(),
    salutation: z.enum(SALUTATIONS).optional(),
    school: z.enum(SCHOOL_IDS),
  }),
  event("org.holiday.created", {
    name: string(),
    start: simpleDateSchema,
    end: simpleDateSchema,
    state: z.enum(STATE_CODES),
    year: number(),
  }),
  event("org.courses.created", {
    id: string().uuid(),
    name: string(),
    subject: z.enum(SUBJECT_IDS),
    isMandatory: boolean(),
    school: z.enum(SCHOOL_IDS),
    semester: object({
      type: z.enum(SEMESTER_TYPES),
      year: number().int().min(2000).max(2100),
    }),
    classes: array(
      z.object({
        identifierInYear: string(),
        startYear: number(),
      }),
    ),
    teachers: array(string().uuid()),
  }),
  event("org.timetable.entryCreated", {
    course: string().uuid(),
    start: date(),
    duration: number(),
    rooms: array(string()),
  }),
  event("org.timetable.substituted", {
    course: string().uuid(),
    start: date(),
    originalTeacher: string().uuid(),
    substitute: string().uuid(),
  }),
  event("org.timetable.canceled", {
    course: string().uuid(),
    start: date(),
    originalTeacher: string().uuid(),
  }),
  event("org.timetable.discarded", {
    course: string().uuid(),
    start: date(),
  }),
  event("auth.licenseGenerated", {
    licenseKey: string(),
    school: z.enum(SCHOOL_IDS),
    expiryDate: date(),
  }),
  event("auth.licenseActivated", {
    userId: string().uuid(),
    licenseKey: string(),
  }),
  event("student.joined", {
    studentId: string().uuid(),
    name: string(),
    school: z.enum(SCHOOL_IDS),
    isOfAge: boolean(),
    class: object({
      identifier: string(),
      startYear: number(),
    }),
  }),
  event("student.courseAssigned", {
    studentId: string().uuid(),
    courseId: string().uuid(),
  }),
]);
export type DomainEvent = z.infer<typeof DomainEvent>;
export type EventName = DomainEvent["type"];
export const EVENT_TYPES = DomainEvent.options.map((thing) => thing.shape.type.value) as [EventName, ...EventName[]]; // Assure TS that it's non-empty

export const studentsOfCourse = (courseId: string) => `students.courses.${courseId}`;

export const studentsOfYear = (options: { school: SchoolId; startYear: number }) =>
  `students.schools.${options.school}.years.${options.startYear}`;

export const studentsOfSchool = (school: SchoolId) => `students.schools.${school}`;

export const studentsOfState = (stateCode: StateCode) => `students.states.${stateCode}`;
