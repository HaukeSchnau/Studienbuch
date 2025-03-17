import {
  array,
  boolean,
  date,
  discriminatedUnion,
  literal,
  number,
  object,
  string,
  z,
} from "zod";

import { SUBJECT_IDS } from "./courses";
import { GRADE_TYPES } from "./grades";
import { SCHOOL_IDS, SEMESTER_TYPES, STATE_CODES } from "./schools";
import { SALUTATIONS } from "./users";

const virtual = <const T>(type: T) =>
  z
    .any()
    .optional()
    .transform(() => type);

export const DomainEvent = discriminatedUnion("type", [
  object({
    type: literal("absence.recorded"),
    data: object({
      date: date(),
      reason: string(),
      courseIds: array(string().uuid()).min(1),
    }),
  }),
  object({
    type: literal("absence.parentApproved"),
    data: object({
      date: date(),
      signature: string(),
    }),
  }),
  object({
    type: literal("absence.teacherApproved"),
    data: object({
      date: date(),
      courseId: string().uuid(),
      signature: string(),
    }),
  }),
  object({
    type: literal("absence.discarded"),
    data: object({
      date: date(),
      courseIds: array(string().uuid()),
    }),
  }),

  object({
    type: literal("grades.currentGradeSet"),
    data: object({
      courseId: string().uuid(),
      date: date(),
      result: number(),
      type: z.enum(GRADE_TYPES),
    }),
  }),
  object({
    type: literal("grades.writtenGradeRecorded"),
    data: object({
      courseId: string(),
      date: date(),
      result: number(),
    }),
  }),
  object({
    type: literal("grades.teacherApproved"),
    data: object({
      date: date(),
      course: string(),
      type: z.enum(GRADE_TYPES),
      signature: string(),
    }),
  }),
  object({
    type: literal("grades.parentApproved"),
    data: object({
      date: date(),
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
      signature: string(),
    }),
  }),
  object({
    type: literal("grades.discarded"),
    data: object({
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
      date: date(),
    }),
  }),
  object({
    type: literal("grades.latestRestored"),
    data: object({
      course: string().uuid(),
      type: z.enum(GRADE_TYPES),
    }),
  }),

  object({
    type: literal("org.school.founded"),
    data: object({
      id: z.enum(SCHOOL_IDS),
      name: string(),
      state: z.enum(STATE_CODES),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.year.started"),
    data: object({
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
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.teacher.joined"),
    data: object({
      personId: string().uuid(),
      firstName: string().optional(),
      lastName: string().optional(),
      abbrv: string(),
      salutation: z.enum(SALUTATIONS).optional(),
      school: z.enum(SCHOOL_IDS),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.holiday.created"),
    data: object({
      name: string(),
      start: date(),
      end: date(),
      state: z.enum(STATE_CODES),
      year: number(),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.courses.created"),
    data: object({
      id: string().uuid(),
      name: string(),
      longName: string(),
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
    errors: virtual(["EXISTS", "CLASS_NOT_FOUND", "NOT_ALLOWED"]),
  }),

  object({
    type: literal("org.timetable.entryCreated"),
    data: object({
      course: string().uuid(),
      start: date(),
      duration: number(),
      rooms: array(string()),
    }),
    errors: virtual(["NOT_ALLOWED", "COURSE_NOT_FOUND"]),
  }),
  object({
    type: literal("org.timetable.substituted"),
    data: object({
      course: string().uuid(),
      start: date(),
      originalTeacher: string().uuid(),
      substitute: string().uuid(),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.timetable.canceled"),
    data: object({
      course: string().uuid(),
      start: date(),
      originalTeacher: string().uuid(),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),
  object({
    type: literal("org.timetable.discarded"),
    data: object({
      course: string().uuid(),
      start: date(),
    }),
    errors: virtual(["DOES_NOT_EXIST", "NOT_ALLOWED"]),
  }),

  object({
    type: literal("auth.licenseGenerated"),
    data: object({
      licenseKey: string(),
      school: z.enum(SCHOOL_IDS),
      expiryDate: date(),
    }),
    errors: virtual(["EXISTS", "NOT_ALLOWED"]),
  }),

  object({
    type: literal("auth.licenseActivated"),
    data: object({
      userId: string().uuid(),
      licenseKey: string(),
    }),
    errors: virtual(["EXISTS", "INVALID_LICENSE_KEY"]),
  }),

  // This causes the user to be subscribed to the year topic
  object({
    type: literal("student.joined"),
    data: object({
      studentId: string().uuid(),
      name: string(),
      school: z.enum(SCHOOL_IDS),
      isOfAge: boolean(),
      class: object({
        identifier: string(),
        startYear: number(),
      }),
    }),
    errors: virtual(["NOT_ALLOWED", "INVALID_CLASS"]),
  }),

  // This causes the user to be subscribed to the course topic
  object({
    type: literal("student.courseAssigned"),
    data: object({
      studentId: string().uuid(),
      courseId: string().uuid(),
    }),
    errors: virtual(["ALREADY_ASSIGNED", "NOT_ALLOWED", "INVALID_COURSE"]),
  }),
]);

export const EventMetadata = object({
  id: string().uuid(),
  timestamp: date(),
});

export const NAMESPACES = [
  "absence",
  "grades",
  "org",
  "student",
  "auth",
] as const;

export const Snapshot = discriminatedUnion("type", [
  object({
    type: literal("year"),
    data: object({
      name: string(),
      startYear: number(),
      graduationYear: number(),

      school: object({
        id: z.enum(SCHOOL_IDS),
        name: string(),
        state: z.enum(STATE_CODES),
      }),

      semesters: array(
        object({
          type: z.enum(SEMESTER_TYPES),
          year: number(),
          start: date(),
          end: date(),
        }),
      ),
    }),
  }),
]);
