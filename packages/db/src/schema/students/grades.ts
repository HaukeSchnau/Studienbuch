import { relations } from "drizzle-orm";
import {
  date,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { GRADE_TYPES } from "@stu/lib";

import { Persons } from "../people/persons";
import { Courses } from "../school/courses";

export const GradeType = pgEnum("grade_type", GRADE_TYPES);

export const Grades = pgTable(
  "grades",
  {
    date: date("date", { mode: "date" }).notNull(),
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

    student: uuid("student")
      .notNull()
      .references(() => Persons.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.date, table.course, table.student, table.type],
      }),
    };
  },
);

export const GradesRelations = relations(Grades, ({ one }) => ({
  course: one(Courses, {
    fields: [Grades.course],
    references: [Courses.id],
  }),
  student: one(Persons, {
    fields: [Grades.student],
    references: [Persons.id],
  }),
}));
