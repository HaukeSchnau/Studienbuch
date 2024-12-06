import { relations } from "drizzle-orm";
import {
  foreignKey,
  int,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { Courses } from "../school/courses";
import { Rooms } from "../school/rooms";
import { timestamp, uuid } from "../utils";

export const TimetableEntries = sqliteTable(
  "timetable_entries",
  {
    start: timestamp("date").notNull(),
    duration: int("duration").notNull(),

    course: uuid("course")
      .notNull()
      .references(() => Courses.id),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.start, table.course],
      }),
    };
  },
);

export const TimetableEntryRooms = sqliteTable(
  "timetable_entry_rooms",
  {
    start: timestamp("start").notNull(),
    course: uuid("course").notNull(),
    roomNumber: text("room")
      .notNull()
      .references(() => Rooms.roomNumber, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.start, table.course, table.roomNumber],
      }),
      timetable_entry_fk: foreignKey({
        columns: [table.start, table.course],
        foreignColumns: [TimetableEntries.start, TimetableEntries.course],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const TimetableEntryRelations = relations(
  TimetableEntries,
  ({ one, many }) => ({
    course: one(Courses, {
      fields: [TimetableEntries.course],
      references: [Courses.id],
    }),
    rooms: many(TimetableEntryRooms),
  }),
);

export const TimetableEntryRoomsRelations = relations(
  TimetableEntryRooms,
  ({ one }) => ({
    timetableEntry: one(TimetableEntries, {
      fields: [TimetableEntryRooms.start, TimetableEntryRooms.course],
      references: [TimetableEntries.start, TimetableEntries.course],
    }),
    room: one(Rooms, {
      fields: [TimetableEntryRooms.roomNumber],
      references: [Rooms.roomNumber],
    }),
  }),
);
