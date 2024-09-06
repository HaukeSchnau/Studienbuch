import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { Persons } from "../people/persons";
import { Courses } from "../school/courses";
import { boolean, timestamp, jsonb, uuid } from "../utils";

export const Tasks = sqliteTable("tasks", {
  id: uuid("id").primaryKey().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
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
  images: jsonb("images").$type<string[]>().default([]).notNull(),
  done: boolean("done").default(false).notNull(),
});
