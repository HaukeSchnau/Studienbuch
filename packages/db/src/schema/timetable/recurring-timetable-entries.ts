import {
  interval,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  uuid,
} from "drizzle-orm/pg-core";

import { Courses } from "../school/courses";

export const RecurringTimetableEntryWeeks = pgEnum(
  "recurring_timetable_entry_weeks",
  ["EVEN", "ODD", "ALL"],
);

export const RecurringTimetableEntries = pgTable(
  "recurring_timetable_entries",
  {
    weekday: smallint("weekday").notNull(),
    start: time("start").notNull(),
    duration: interval("duration").notNull(),
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
