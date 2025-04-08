import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { persons } from "../people/persons";
import { courses } from "../school/courses";
import { boolean, jsonb, timestamp, uuid } from "../utils";

export const tasks = sqliteTable("tasks", {
  id: uuid("id").primaryKey().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
  course: uuid("course")
    .notNull()
    .references(() => courses.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  assignee: uuid("assignee")
    .notNull()
    .references(() => persons.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  images: jsonb("images").$type<string[]>().default([]).notNull(),
  done: boolean("done").default(false).notNull(),
});
