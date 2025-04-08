import { relations } from "drizzle-orm";
import {
  foreignKey,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { courses } from "../school/courses";
import { timestamp, uuid } from "../utils";

export const absenceDays = sqliteTable(
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

export const courseAbsences = sqliteTable(
  "course_absences",
  {
    date: timestamp("date").notNull(),
    course: uuid("course")
      .notNull()
      .references(() => courses.id, {
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
        foreignColumns: [absenceDays.date],
      }),
    };
  },
);

export const absenceDaysRelations = relations(absenceDays, ({ many }) => ({
  absenceCourses: many(courseAbsences),
}));

export const absenceCoursesRelations = relations(courseAbsences, ({ one }) => ({
  course: one(courses, {
    fields: [courseAbsences.course],
    references: [courses.id],
  }),
  absenceDay: one(absenceDays, {
    fields: [courseAbsences.date],
    references: [absenceDays.date],
  }),
}));
