import { SUBSTITUTION_TYPES } from "@stu/lib";
import { relations } from "drizzle-orm";
import { foreignKey, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { persons } from "../people/persons";
import { sqliteEnum, timestamp, uuid } from "../utils";
import { timetableEntries } from "./timetable-entries";

export const substitutionType = sqliteEnum(SUBSTITUTION_TYPES);

export const substitutions = sqliteTable(
  "substitutions",
  {
    start: timestamp("date").notNull(),
    course: uuid("course").notNull(),
    type: substitutionType("type"),

    substitute: uuid("substitute").references(() => persons.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),

    // createdAt: timestamp("createdAt").defaultNow().notNull(),
    // updatedAt: timestamp("updatedAt").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.start, table.course] }),
      timetable_entry_fk: foreignKey({
        columns: [table.start, table.course],
        foreignColumns: [timetableEntries.start, timetableEntries.course],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const substitutionRelations = relations(substitutions, ({ one }) => ({
  substitute: one(persons, {
    fields: [substitutions.substitute],
    references: [persons.id],
  }),
  timetableEntry: one(timetableEntries, {
    fields: [substitutions.start, substitutions.course],
    references: [timetableEntries.start, timetableEntries.course],
  }),
}));

export const roomChanges = sqliteTable("room_changes", {
  start: timestamp("date").notNull(),
  course: uuid("course").notNull(),
  room: text("room").notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const roomChangeRelations = relations(roomChanges, ({ one }) => ({
  timetableEntry: one(timetableEntries, {
    fields: [roomChanges.start, roomChanges.course],
    references: [timetableEntries.start, timetableEntries.course],
  }),
}));
