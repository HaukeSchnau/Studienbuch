import { numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { Persons } from "../people/persons";
import { Courses } from "../school/courses";
import { sqliteEnum, timestamp, uuid } from "../utils";

export const GradeType = sqliteEnum(["WRITTEN", "ORAL", "MASTER"]);

export const Grades = sqliteTable("grades", {
  id: uuid("id").primaryKey().notNull(),
  date: timestamp("date").notNull(),
  result: numeric("result").notNull(),
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
