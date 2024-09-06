import { relations } from "drizzle-orm";
import {
  foreignKey,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { SUBSTITUTION_TYPES } from "@stu/lib";

import { Persons } from "../people/persons";
import { sqliteEnum, timestamp, uuid } from "../utils";
import { TimetableEntries } from "./timetable-entries";

export const SubstitutionType = sqliteEnum(SUBSTITUTION_TYPES);

export const Substitutions = sqliteTable(
  "substitutions",
  {
    start: timestamp("date").notNull(),
    course: text("course").notNull(),
    type: SubstitutionType("type"),

    substitute: uuid("substitute").references(() => Persons.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.start, table.course] }),
      timetable_entry_fk: foreignKey({
        columns: [table.start, table.course],
        foreignColumns: [TimetableEntries.start, TimetableEntries.course],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const SubstitutionRelations = relations(Substitutions, ({ one }) => ({
  substitute: one(Persons, {
    fields: [Substitutions.substitute],
    references: [Persons.id],
  }),
  timetableEntry: one(TimetableEntries, {
    fields: [Substitutions.start, Substitutions.course],
    references: [TimetableEntries.start, TimetableEntries.course],
  }),
}));
