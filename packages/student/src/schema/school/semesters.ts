import { SEMESTER_TYPES } from "@stu/lib";
import { relations } from "drizzle-orm";
import { foreignKey, int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEnum, timestamp } from "../utils";
import { schoolId } from "./school-id";
import { schools, stateCode } from "./schools";
import { years } from "./years";

export const semesterType = sqliteEnum(SEMESTER_TYPES);

export const semesters = sqliteTable(
  "semesters",
  {
    name: text("name").notNull(),
    start: timestamp("start").notNull(),
    end: timestamp("end").notNull(),
    school: schoolId("school")
      .notNull()
      .references(() => schools.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    type: semesterType("type").notNull(),
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

export const yearSemesters = sqliteTable(
  "year_semesters",
  {
    school: schoolId("school").notNull(),
    startYear: int("start_year").notNull(),
    semesterYear: int("semester_year").notNull(),
    semesterType: semesterType("semester_type").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.school, table.startYear, table.semesterYear, table.semesterType],
      }),
      year_fk: foreignKey({
        columns: [table.school, table.startYear],
        foreignColumns: [years.school, years.startYear],
      }),
      semester_fk: foreignKey({
        columns: [table.school, table.semesterYear, table.semesterType],
        foreignColumns: [semesters.school, semesters.year, semesters.type],
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
    state: stateCode("state").notNull(),
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

export const semesterRelations = relations(semesters, ({ one }) => ({
  school: one(schools, {
    fields: [semesters.school],
    references: [schools.id],
  }),
}));
