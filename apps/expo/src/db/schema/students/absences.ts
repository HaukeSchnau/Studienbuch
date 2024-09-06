import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { Persons } from "../people/persons";
import { Courses } from "../school/courses";
import { timestamp } from "../utils";

export const Absences = sqliteTable(
  "absences",
  {
    date: timestamp("date").notNull(),
    course: text("course")
      .notNull()
      .references(() => Courses.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    student: text("student")
      .notNull()
      .references(() => Persons.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    reason: text("reason").notNull(),
    teacherSignature: text("teacher_signature"),
    parentSignature: text("parent_signature"),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.date, table.course, table.student],
      }),
    };
  },
);
