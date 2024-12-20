import { relations } from "drizzle-orm";
import {
  foreignKey,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { SUBSTITUTION_TYPES } from "@stu/lib";

import { persons } from "../people/persons";
import { Rooms } from "../school/rooms";
import { sqliteEnum, timestamp, uuid } from "../utils";
import { TimetableEntries } from "./timetable-entries";

export const SubstitutionType = sqliteEnum(SUBSTITUTION_TYPES);

export const Substitutions = sqliteTable(
  "substitutions",
  {
    start: timestamp("date").notNull(),
    course: uuid("course").notNull(),
    type: SubstitutionType("type"),

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
        foreignColumns: [TimetableEntries.start, TimetableEntries.course],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const SubstitutionRelations = relations(Substitutions, ({ one }) => ({
  substitute: one(persons, {
    fields: [Substitutions.substitute],
    references: [persons.id],
  }),
  timetableEntry: one(TimetableEntries, {
    fields: [Substitutions.start, Substitutions.course],
    references: [TimetableEntries.start, TimetableEntries.course],
  }),
}));

export const RoomChanges = sqliteTable("room_changes", {
  start: timestamp("date").notNull(),
  course: uuid("course").notNull(),
  room: text("room")
    .notNull()
    .references(() => Rooms.roomNumber, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const RoomChangeRelations = relations(RoomChanges, ({ one }) => ({
  timetableEntry: one(TimetableEntries, {
    fields: [RoomChanges.start, RoomChanges.course],
    references: [TimetableEntries.start, TimetableEntries.course],
  }),
}));
