import { relations } from "drizzle-orm";
import {
  foreignKey,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { Courses } from "../school/courses";
import { timestamp, uuid } from "../utils";

export const AbsenceDays = sqliteTable(
  "absence_days",
  {
    date: timestamp("date").notNull(),

    reason: text("reason").notNull(),
    parentSignature: text("parent_signature"),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.date],
      }),
    };
  },
);

export const CourseAbsences = sqliteTable(
  "course_absences",
  {
    date: timestamp("date").notNull(),
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
        columns: [table.date, table.course],
      }),
      absence_days_fk: foreignKey({
        columns: [table.date],
        foreignColumns: [AbsenceDays.date],
      }),
    };
  },
);

export const AbsenceDaysRelations = relations(AbsenceDays, ({ many }) => ({
  absenceCourses: many(CourseAbsences),
}));

export const AbsenceCoursesRelations = relations(CourseAbsences, ({ one }) => ({
  course: one(Courses, {
    fields: [CourseAbsences.course],
    references: [Courses.id],
  }),
  absenceDay: one(AbsenceDays, {
    fields: [CourseAbsences.date],
    references: [AbsenceDays.date],
  }),
}));
