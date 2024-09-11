import { relations } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { SUBJECT_IDS } from "@stu/lib";

import { Persons } from "../people/persons";
import { TimetableEntries } from "../timetable/timetable-entries";
import { Classes } from "./classes";
import { SchoolId } from "./school-id";
import { Semesters, SemesterType } from "./semesters";

export const Subject = pgEnum("subject", SUBJECT_IDS);

export const Courses = pgTable("courses", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  longName: text("long_name").notNull(),
  subject: Subject("subject").notNull(),
});

export const CourseRelations = relations(Courses, ({ many }) => ({
  timetableEntries: many(TimetableEntries),
  recurringTimetableEntries: many(TimetableEntries),
  semesterCourses: many(SemesterCourses),
}));

export const SemesterCourses = pgTable(
  "semester_courses",
  {
    course: uuid("course")
      .notNull()
      .references(() => Courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    school: SchoolId("school").notNull(),
    semesterType: SemesterType("semester_type").notNull(),
    semesterYear: smallint("semester_year").notNull(),

    isMandatory: boolean("is_mandatory").notNull().default(false),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [
          table.course,
          table.semesterType,
          table.semesterYear,
          table.school,
        ],
      }),
      semester_fk: foreignKey({
        columns: [table.semesterType, table.semesterYear, table.school],
        foreignColumns: [Semesters.type, Semesters.year, Semesters.school],
      })
        .onDelete("restrict")
        .onUpdate("cascade"),
    };
  },
);

export const SemesterCourseRelations = relations(
  SemesterCourses,
  ({ one, many }) => ({
    course: one(Courses, {
      fields: [SemesterCourses.course],
      references: [Courses.id],
    }),
    teachers: many(SemesterCoursesToTeachers),
    classes: many(SemesterCoursesToClasses),
  }),
);

export const SemesterCoursesToTeachers = pgTable(
  "semester_courses_to_teachers",
  {
    course: uuid("course").notNull(),
    semesterType: SemesterType("semester_type").notNull(),
    semesterYear: smallint("semester_year").notNull(),

    school: SchoolId("school").notNull(),

    teacher: uuid("teacher").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [
          table.course,
          table.semesterType,
          table.semesterYear,
          table.teacher,
          table.school,
        ],
      }),

      semester_course_fk: foreignKey({
        columns: [
          table.course,
          table.semesterType,
          table.semesterYear,
          table.school,
        ],
        foreignColumns: [
          SemesterCourses.course,
          SemesterCourses.semesterType,
          SemesterCourses.semesterYear,
          SemesterCourses.school,
        ],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),

      teacher_fk: foreignKey({
        columns: [table.teacher],
        foreignColumns: [Persons.id],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const SemesterCoursesToTeachersRelations = relations(
  SemesterCoursesToTeachers,
  ({ one }) => ({
    course: one(SemesterCourses, {
      fields: [
        SemesterCoursesToTeachers.course,
        SemesterCoursesToTeachers.semesterType,
        SemesterCoursesToTeachers.semesterYear,
        SemesterCoursesToTeachers.school,
      ],
      references: [
        SemesterCourses.course,
        SemesterCourses.semesterType,
        SemesterCourses.semesterYear,
        SemesterCourses.school,
      ],
    }),
    teacher: one(Persons, {
      fields: [SemesterCoursesToTeachers.teacher],
      references: [Persons.id],
    }),
  }),
);

export const SemesterCoursesToClasses = pgTable(
  "semester_courses_to_classes",
  {
    course: uuid("course").notNull(),
    semesterType: SemesterType("semester_type").notNull(),
    semesterYear: smallint("semester_year").notNull(),

    school: SchoolId("school").notNull(),

    classIdentifier: text("class_identifier").notNull(),
    classStartYear: smallint("class_start_year").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [
          table.course,
          table.semesterType,
          table.semesterYear,
          table.classIdentifier,
          table.classStartYear,
          table.school,
        ],
      }),

      semester_course_fk: foreignKey({
        columns: [
          table.course,
          table.semesterType,
          table.semesterYear,
          table.school,
        ],
        foreignColumns: [
          SemesterCourses.course,
          SemesterCourses.semesterType,
          SemesterCourses.semesterYear,
          SemesterCourses.school,
        ],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),

      class_fk: foreignKey({
        columns: [table.classIdentifier, table.classStartYear, table.school],
        foreignColumns: [
          Classes.identifierInYear,
          Classes.startYear,
          Classes.school,
        ],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const SemesterCoursesToClassesRelations = relations(
  SemesterCoursesToClasses,
  ({ one }) => ({
    course: one(SemesterCourses, {
      fields: [
        SemesterCoursesToClasses.course,
        SemesterCoursesToClasses.semesterType,
        SemesterCoursesToClasses.semesterYear,
        SemesterCoursesToClasses.school,
      ],
      references: [
        SemesterCourses.course,
        SemesterCourses.semesterType,
        SemesterCourses.semesterYear,
        SemesterCourses.school,
      ],
    }),
    class: one(Classes, {
      fields: [
        SemesterCoursesToClasses.classIdentifier,
        SemesterCoursesToClasses.classStartYear,
        SemesterCoursesToClasses.school,
      ],
      references: [Classes.identifierInYear, Classes.startYear, Classes.school],
    }),
  }),
);
