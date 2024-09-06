import { relations } from "drizzle-orm";
import {
  foreignKey,
  int,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { Courses, SemesterCourses } from "../school/courses";
import { Rooms } from "../school/rooms";
import { SchoolId } from "../school/school-id";
import { SemesterType } from "../school/semesters";
import { timestamp } from "../utils";

export const TimetableEntries = sqliteTable(
  "timetable_entries",
  {
    start: timestamp("date").notNull(),
    duration: int("duration").notNull(),

    course: text("course").notNull(),
    semesterType: SemesterType("semester_type").notNull(),
    semesterYear: int("semester_year").notNull(),
    school: SchoolId("school").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.start, table.course],
      }),

      semester_course_fk: foreignKey({
        columns: [
          table.course,
          table.semesterType,
          table.semesterYear,
          table.school,
        ],
        foreignColumns: [
          SemesterCourses.course,
          SemesterCourses.semesterType,
          SemesterCourses.semesterYear,
          SemesterCourses.school,
        ],
      }),
    };
  },
);

export const TimetableEntryRooms = sqliteTable(
  "timetable_entry_rooms",
  {
    start: timestamp("start").notNull(),
    course: text("course").notNull(),
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
