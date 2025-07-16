import { SEMESTER_TYPES } from "@stu/lib";
import { relations } from "drizzle-orm";
import { date, integer, pgEnum, pgTable, primaryKey, smallint, text, timestamp } from "drizzle-orm/pg-core";

import { SchoolId } from "./school-id";
import { Schools, StateCode } from "./schools";

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

export const holidays = pgTable(
  "holidays",
  {
    name: text("name").notNull(),
    start: timestamp("start").notNull(),
    end: timestamp("end").notNull(),
    state: StateCode("state").notNull(),
    year: integer("year").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.name, table.state, table.year],
      }),
    };
  },
);
