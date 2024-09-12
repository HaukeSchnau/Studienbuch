import { relations } from "drizzle-orm";
import {
  foreignKey,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { Courses, SemesterCourses } from "../school/courses";
import { Rooms } from "../school/rooms";
import { SchoolId } from "../school/school-id";
import { SemesterType } from "../school/semesters";

export const TimetableEntries = pgTable(
  "timetable_entries",
  {
    start: timestamp("date", { mode: "date" }).notNull(),
    duration: smallint("duration").notNull(),

    course: uuid("course").notNull(),
    semesterType: SemesterType("semester_type").notNull(),
    semesterYear: smallint("semester_year").notNull(),
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

export const TimetableEntryRooms = pgTable(
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
