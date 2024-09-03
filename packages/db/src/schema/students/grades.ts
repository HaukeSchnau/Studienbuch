import {
  date,
  numeric,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { Persons } from "../people/persons";
import { Courses } from "../school/courses";

export const GradeType = pgEnum("grade_type", ["WRITTEN", "ORAL", "MASTER"]);

export const Grades = pgTable("grades", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  date: date("date", { mode: "date" }).notNull(),
  result: numeric("result", { precision: 65, scale: 30 }).notNull(),
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
});
