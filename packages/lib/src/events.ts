import { array, boolean, date, discriminatedUnion, literal, number, object, string, z } from "zod";

import { SUBJECT_IDS } from "./courses";
import { GRADE_TYPES } from "./grades";
import type { SchoolId, StateCode } from "./schools";
import { SCHOOL_IDS, SEMESTER_TYPES, STATE_CODES } from "./schools";
import { SALUTATIONS } from "./users";
import { createDomainEvent as event, createEventUnion } from "@groundswell/zod-helpers";

export const DomainEvent = createEventUnion([
  event(
    "absence.recorded",
    object({
      date: date(),
      reason: string(),
      courseIds: array(string().uuid()).min(1),
    }),
  ),
  event(
    "absence.parentApproved",
    object({
      date: date(),
      signature: string(),
    }),
  ),
  event(
    "absence.teacherApproved",
    object({
      date: date(),
      courseId: string().uuid(),
      signature: string(),
    }),
  ),
  event(
    "absence.discarded",
    object({
      date: date(),
      courseIds: array(string().uuid()),
    }),
  ),
  event(
    "grades.currentGradeSet",
    object({
      courseId: string().uuid(),
      date: date(),
      result: number(),
      type: z.enum(GRADE_TYPES),
    }),
  ),
  event(
    "grades.writtenGradeRecorded",
    object({
      courseId: string(),
      date: date(),
      result: number(),
    }),
  ),
  event(
    "grades.teacherApproved",
    object({
      date: date(),
      course: string(),
      type: z.enum(GRADE_TYPES),
      signature: string(),
    }),
  ),
  event(
    "grades.parentApproved",
    object({
      date: date(),
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
      signature: string(),
    }),
  ),
  event(
    "grades.discarded",
    object({
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
      date: date(),
    }),
  ),
  event(
    "grades.latestRestored",
    object({
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
    }),
  ),
  event(
    "org.school.founded",
    object({
      id: z.enum(SCHOOL_IDS),
      name: string(),
      state: z.enum(STATE_CODES),
    }),
  ),
  event(
    "org.year.started",
    object({
      name: string(),
      startYear: number(),
      graduationYear: number(),
      school: z.enum(SCHOOL_IDS),
      classes: array(
        object({
          identifierInYear: string(),
          teachers: array(string().uuid()),
        }),
      ),
    }),
  ),
  event(
    "org.teacher.joined",
    object({
      personId: string().uuid(),
      firstName: string().optional(),
      lastName: string().optional(),
      abbrv: string(),
      salutation: z.enum(SALUTATIONS).optional(),
      school: z.enum(SCHOOL_IDS),
    }),
  ),
  event(
    "org.holiday.created",
    object({
      name: string(),
      start: date(),
      end: date(),
      state: z.enum(STATE_CODES),
      year: number(),
    }),
  ),
  event(
    "org.courses.created",
    object({
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
        object({
          identifierInYear: string(),
          startYear: number(),
        }),
      ),
      teachers: array(string().uuid()),
    }),
  ),
  event(
    "org.timetable.entryCreated",
    object({
      course: string().uuid(),
      start: date(),
      duration: number(),
      rooms: array(string()),
    }),
  ),
  event(
    "org.timetable.substituted",
    object({
      course: string().uuid(),
      start: date(),
      originalTeacher: string().uuid(),
      substitute: string().uuid(),
    }),
  ),
  event(
    "org.timetable.canceled",
    object({
      course: string().uuid(),
      start: date(),
      originalTeacher: string().uuid(),
    }),
  ),
  event(
    "org.timetable.discarded",
    object({
      course: string().uuid(),
      start: date(),
    }),
  ),
  event(
    "auth.licenseGenerated",
    object({
      licenseKey: string(),
      school: z.enum(SCHOOL_IDS),
      expiryDate: date(),
    }),
  ),
  event(
    "auth.licenseActivated",
    object({
      userId: string().uuid(),
      licenseKey: string(),
    }),
  ),
  event(
    "student.joined",
    object({
      studentId: string().uuid(),
      name: string(),
      school: z.enum(SCHOOL_IDS),
      isOfAge: boolean(),
      class: object({
        identifier: string(),
        startYear: number(),
      }),
    }),
  ),
  event(
    "student.courseAssigned",
    object({
      studentId: string().uuid(),
      courseId: string().uuid(),
    }),
  ),
]);
export type DomainEvent = z.infer<typeof DomainEvent>;
export type EventName = DomainEvent["type"];
export const EVENT_TYPES = DomainEvent.options.map((thing) => thing.shape.type.value) as [EventName, ...EventName[]]; // Assure TS that it's non-empty

export const studentsOfCourse = (courseId: string) => `students.courses.${courseId}`;

export const studentsOfYear = (options: {
  school: SchoolId;
  startYear: number;
}) => `students.schools.${options.school}.years.${options.startYear}`;

export const studentsOfSchool = (school: SchoolId) => `students.schools.${school}`;

export const studentsOfState = (stateCode: StateCode) => `students.states.${stateCode}`;
