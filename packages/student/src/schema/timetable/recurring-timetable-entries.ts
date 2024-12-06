import { int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { Courses } from "../school/courses";
import { sqliteEnum, uuid } from "../utils";

export const RecurringTimetableEntryWeeks = sqliteEnum(["EVEN", "ODD", "ALL"]);

export const RecurringTimetableEntries = sqliteTable(
  "recurring_timetable_entries",
  {
    weekday: int("weekday").notNull(),
    start: int("start").notNull(),
    duration: int("duration").notNull(),
    weeks: RecurringTimetableEntryWeeks("weeks").default("ALL").notNull(),
    room: text("room"),

    course: uuid("course")
      .notNull()
      .references(() => Courses.id, {
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
