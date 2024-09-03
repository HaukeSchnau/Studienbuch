import { boolean, date, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { Persons } from "../people/persons";
import { Courses } from "../school/courses";

export const Tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueDate: date("due_date", { mode: "date" }).notNull(),
  course: uuid("course")
    .notNull()
    .references(() => Courses.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  assignee: uuid("assignee")
    .notNull()
    .references(() => Persons.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  images: text("images").array().default([]).notNull(),
  done: boolean("done").default(false).notNull(),
});
