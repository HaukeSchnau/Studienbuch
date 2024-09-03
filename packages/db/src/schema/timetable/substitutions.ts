import { relations } from "drizzle-orm";
import {
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { SUBSTITUTION_TYPES } from "@stu/lib";

import { Persons } from "../people/persons";
import { TimetableEntries } from "./timetable-entries";

export const SubstitutionType = pgEnum("substitution_type", SUBSTITUTION_TYPES);

export const Substitutions = pgTable(
  "substitutions",
  {
    start: timestamp("date").notNull(),
    course: uuid("course").notNull(),
    type: SubstitutionType("type"),
    
    substitute: uuid("substitute").references(() => Persons.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),

    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", {
      precision: 3,
      mode: "date",
    }).notNull(),
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
