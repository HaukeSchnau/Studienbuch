import { relations } from "drizzle-orm";
import { primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { GRADE_TYPES } from "@stu/lib";

import { courses } from "../school/courses";
import { sqliteEnum, timestamp, uuid } from "../utils";

export const gradeType = sqliteEnum(GRADE_TYPES);

export const grades = sqliteTable(
  "grades",
  {
    date: timestamp("date").notNull(),
    result: real("result").notNull(),
    type: gradeType("type").notNull(),

    teacherSignature: text("teacher_signature"),
    parentSignature: text("parent_signature"),

    course: uuid("course")
      .notNull()
      .references(() => courses.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.date, table.course, table.type],
      }),
    };
  },
);

export const gradesRelations = relations(grades, ({ one }) => ({
  course: one(courses, {
    fields: [grades.course],
    references: [courses.id],
  }),
}));
