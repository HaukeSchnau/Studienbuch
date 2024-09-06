import { relations } from "drizzle-orm";
import {
  int,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { SEMESTER_TYPES } from "@stu/lib";

import { SchoolId } from "./school-id";
import { Schools } from "./schools";
import { timestamp, sqliteEnum } from "../utils";

export const SemesterType = sqliteEnum(SEMESTER_TYPES);

export const Semesters = sqliteTable(
  "semesters",
  {
    name: text("name").notNull(),
    start: timestamp("start").notNull(),
    end: timestamp("end").notNull(),
    school: SchoolId("school")
      .notNull()
      .references(() => Schools.id, {
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

export const SemesterRelations = relations(Semesters, ({ one }) => ({
  school: one(Schools, {
    fields: [Semesters.school],
    references: [Schools.id],
  }),
}));
