import { date, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { Persons } from "../people/persons";
import { Courses } from "../school/courses";

export const Absences = pgTable(
  "absences",
  {
    date: date("date", {mode: 'date'}).notNull(),
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

    reason: text("reason").notNull(),
    teacherSignature: text("teacher_signature"),
    parentSignature: text("parent_signature"),
  },
  (table) => {
    return {
      pk: {
        columns: [table.date, table.course, table.student],
      },
    };
  },
);
