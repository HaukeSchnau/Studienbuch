import { int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { courses } from "../school/courses";
import { sqliteEnum, uuid } from "../utils";

export const recurringTimetableEntryWeeks = sqliteEnum(["EVEN", "ODD", "ALL"]);

export const recurringTimetableEntries = sqliteTable(
  "recurring_timetable_entries",
  {
    weekday: int("weekday").notNull(),
    start: int("start").notNull(),
    duration: int("duration").notNull(),
    weeks: recurringTimetableEntryWeeks("weeks").default("ALL").notNull(),
    room: text("room"),

    course: uuid("course")
      .notNull()
      .references(() => courses.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.weekday, table.start, table.course],
      }),
    };
  },
);
