import { relations } from "drizzle-orm";
import {
  foreignKey,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { Persons } from "../people/persons";
import { Courses } from "../school/courses";
import { timestamp, uuid } from "../utils";

export const AbsenceDays = sqliteTable(
  "absence_days",
  {
    date: timestamp("date").notNull(),
    student: uuid("student")
      .notNull()
      .references(() => Persons.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    reason: text("reason").notNull(),
    parentSignature: text("parent_signature"),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.date, table.student],
      }),
    };
  },
);

export const CourseAbsences = sqliteTable(
  "course_absences",
  {
    date: timestamp("date").notNull(),
    student: uuid("student")
      .notNull()
      .references(() => Persons.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    course: uuid("course")
      .notNull()
      .references(() => Courses.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    teacherSignature: text("teacher_signature"),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.date, table.course, table.student],
      }),
      absence_days_fk: foreignKey({
        columns: [table.date, table.student],
        foreignColumns: [AbsenceDays.date, AbsenceDays.student],
      }),
    };
  },
);

export const AbsenceDaysRelations = relations(AbsenceDays, ({ one, many }) => ({
  student: one(Persons, {
    fields: [AbsenceDays.student],
    references: [Persons.id],
  }),
  absenceCourses: many(CourseAbsences),
}));

export const AbsenceCoursesRelations = relations(CourseAbsences, ({ one }) => ({
  student: one(Persons, {
    fields: [CourseAbsences.student],
    references: [Persons.id],
  }),
  course: one(Courses, {
    fields: [CourseAbsences.course],
    references: [Courses.id],
  }),
  absenceDay: one(AbsenceDays, {
    fields: [CourseAbsences.date, CourseAbsences.student],
    references: [AbsenceDays.date, AbsenceDays.student],
  }),
}));
