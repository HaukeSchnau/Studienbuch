import { relations } from "drizzle-orm";
import { int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { classes } from "./classes";
import { schoolId } from "./school-id";
import { schools } from "./schools";

export const years = sqliteTable(
  "years",
  {
    name: text("name").notNull(),
    startYear: int("start_year").notNull(),
    graduationYear: int("graduation_year").notNull(),

    school: schoolId("school")
      .notNull()
      .references(() => schools.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.startYear, table.school],
      }),
    };
  },
);

export const yearsRelations = relations(years, ({ one, many }) => ({
  school: one(schools, {
    fields: [years.school],
    references: [schools.id],
  }),
  classes: many(classes),
}));
