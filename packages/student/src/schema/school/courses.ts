import { relations } from "drizzle-orm";
import {
  foreignKey,
  int,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { SUBJECT_IDS } from "@stu/lib";

import { persons } from "../people/persons";
import { timetableEntries } from "../timetable/timetable-entries";
import { boolean, sqliteEnum, uuid } from "../utils";
import { classes } from "./classes";
import { schoolId } from "./school-id";
import { semesters, semesterType } from "./semesters";

export const subject = sqliteEnum(SUBJECT_IDS);

export const courses = sqliteTable(
  "courses",
  {
    id: uuid("id").primaryKey().notNull(),
    name: text("name").notNull(),
    longName: text("long_name").notNull(),
    subject: subject("subject").notNull(),

    school: schoolId("school").notNull(),
    semesterType: semesterType("semester_type").notNull(),
    semesterYear: int("semester_year").notNull(),

    isMandatory: boolean("is_mandatory").notNull().default(false),
    isMember: boolean("is_member").notNull().default(false),
  },
  (table) => {
    return {
      semester_fk: foreignKey({
        columns: [table.semesterType, table.semesterYear, table.school],
        foreignColumns: [semesters.type, semesters.year, semesters.school],
      })
        .onDelete("restrict")
        .onUpdate("cascade"),
    };
  },
);

export const courseRelations = relations(courses, ({ many }) => ({
  teachers: many(coursesToTeachers),
  classes: many(coursesToClasses),

  timetableEntries: many(timetableEntries),
  recurringTimetableEntries: many(timetableEntries),
}));

export const coursesToTeachers = sqliteTable(
  "courses_to_teachers",
  {
    course: uuid("course")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    teacher: uuid("teacher")
      .notNull()
      .references(() => persons.id, {
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

export const coursesToTeachersRelations = relations(
  coursesToTeachers,
  ({ one }) => ({
    course: one(courses, {
      fields: [coursesToTeachers.course],
      references: [courses.id],
    }),
    teacher: one(persons, {
      fields: [coursesToTeachers.teacher],
      references: [persons.id],
    }),
  }),
);

export const coursesToClasses = sqliteTable(
  "courses_to_classes",
  {
    course: uuid("course")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),

    school: schoolId("school").notNull(),
    classIdentifier: text("class_identifier").notNull(),
    classStartYear: int("class_start_year").notNull(),
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
          classes.identifierInYear,
          classes.startYear,
          classes.school,
        ],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const coursesToClassesRelations = relations(
  coursesToClasses,
  ({ one }) => ({
    course: one(courses, {
      fields: [coursesToClasses.course],
      references: [courses.id],
    }),
    class: one(classes, {
      fields: [
        coursesToClasses.classIdentifier,
        coursesToClasses.classStartYear,
        coursesToClasses.school,
      ],
      references: [classes.identifierInYear, classes.startYear, classes.school],
    }),
  }),
);
