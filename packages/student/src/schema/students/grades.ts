import { relations } from "drizzle-orm";
import { primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { GRADE_TYPES } from "@stu/lib";

import { Courses } from "../school/courses";
import { sqliteEnum, timestamp, uuid } from "../utils";

export const GradeType = sqliteEnum(GRADE_TYPES);

export const grades = sqliteTable(
  "grades",
  {
    date: timestamp("date").notNull(),
    result: real("result").notNull(),
    type: GradeType("type").notNull(),

    teacherSignature: text("teacher_signature"),
    parentSignature: text("parent_signature"),

    course: uuid("course")
      .notNull()
      .references(() => Courses.id, {
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

export const GradesRelations = relations(grades, ({ one }) => ({
  course: one(Courses, {
    fields: [grades.course],
    references: [Courses.id],
  }),
}));
