import { relations } from "drizzle-orm";
import {
  date,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
} from "drizzle-orm/pg-core";

import { SEMESTER_TYPES } from "@stu/lib";

import { SchoolId } from "./school-id";
import { Schools } from "./schools";

export const SemesterType = pgEnum("semester_type", SEMESTER_TYPES);

export const Semesters = pgTable(
  "semesters",
  {
    name: text("name").notNull(),
    start: date("start", { mode: "date" }).notNull(),
    end: date("end", { mode: "date" }).notNull(),
    school: SchoolId("school")
      .notNull()
      .references(() => Schools.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    type: SemesterType("type").notNull(),
    year: smallint("year").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.school, table.type, table.year],
      }),
    };
  },
);

export const SemesterRelations = relations(Semesters, ({ one }) => ({
  school: one(Schools, {
    fields: [Semesters.school],
    references: [Schools.id],
  }),
}));
