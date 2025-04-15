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
import { SemesterType, Semesters } from "./semesters";

export const Subject = pgEnum("subject", SUBJECT_IDS);

export const Courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: text("name").notNull(),
    longName: text("long_name").notNull(),
    subject: Subject("subject").notNull(),

    school: SchoolId("school").notNull(),
    semesterType: SemesterType("semester_type").notNull(),
    semesterYear: smallint("semester_year").notNull(),

    isMandatory: boolean("is_mandatory").notNull().default(false),
  },
  (table) => {
    return {
      semester_fk: foreignKey({
        columns: [table.semesterType, table.semesterYear, table.school],
        foreignColumns: [Semesters.type, Semesters.year, Semesters.school],
      })
        .onDelete("restrict")
        .onUpdate("cascade"),
    };
  },
);

export const CourseRelations = relations(Courses, ({ many }) => ({
  teachers: many(CoursesToTeachers),
  classes: many(CoursesToClasses),

  timetableEntries: many(TimetableEntries),
  recurringTimetableEntries: many(TimetableEntries),
}));

export const CoursesToTeachers = pgTable(
  "courses_to_teachers",
  {
    course: uuid("course")
      .notNull()
      .references(() => Courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    teacher: uuid("teacher")
      .notNull()
      .references(() => Persons.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.course, table.teacher],
      }),
    };
  },
);

export const CoursesToTeachersRelations = relations(
  CoursesToTeachers,
  ({ one }) => ({
    course: one(Courses, {
      fields: [CoursesToTeachers.course],
      references: [Courses.id],
    }),
    teacher: one(Persons, {
      fields: [CoursesToTeachers.teacher],
      references: [Persons.id],
    }),
  }),
);

export const CoursesToClasses = pgTable(
  "courses_to_classes",
  {
    course: uuid("course")
      .notNull()
      .references(() => Courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    school: SchoolId("school").notNull(),
    classIdentifier: text("class_identifier").notNull(),
    classStartYear: smallint("class_start_year").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [
          table.course,
          table.classIdentifier,
          table.classStartYear,
          table.school,
        ],
      }),

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

export const CoursesToClassesRelations = relations(
  CoursesToClasses,
  ({ one }) => ({
    course: one(Courses, {
      fields: [CoursesToClasses.course],
      references: [Courses.id],
    }),
    class: one(Classes, {
      fields: [
        CoursesToClasses.classIdentifier,
        CoursesToClasses.classStartYear,
        CoursesToClasses.school,
      ],
      references: [Classes.identifierInYear, Classes.startYear, Classes.school],
    }),
  }),
);
