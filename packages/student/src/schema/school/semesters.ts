import { relations } from "drizzle-orm";
import { int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { SEMESTER_TYPES } from "@stu/lib";

import { sqliteEnum, timestamp } from "../utils";
import { SchoolId } from "./school-id";
import { schools, StateCode } from "./schools";

export const SemesterType = sqliteEnum(SEMESTER_TYPES);

export const semesters = sqliteTable(
  "semesters",
  {
    name: text("name").notNull(),
    start: timestamp("start").notNull(),
    end: timestamp("end").notNull(),
    school: SchoolId("school")
      .notNull()
      .references(() => schools.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    type: SemesterType("type").notNull(),
    year: int("year").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.school, table.type, table.year],
      }),
    };
  },
);

export const holidays = sqliteTable(
  "holidays",
  {
    name: text("name").notNull(),
    start: timestamp("start").notNull(),
    end: timestamp("end").notNull(),
    state: StateCode("state").notNull(),
    year: int("year").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.name, table.start, table.end, table.state, table.year],
      }),
    };
  },
);

export const SemesterRelations = relations(semesters, ({ one }) => ({
  school: one(schools, {
    fields: [semesters.school],
    references: [schools.id],
  }),
}));
