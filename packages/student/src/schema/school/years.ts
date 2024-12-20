import { relations } from "drizzle-orm";
import { int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { Classes } from "./classes";
import { SchoolId } from "./school-id";
import { schools } from "./schools";

export const years = sqliteTable(
  "years",
  {
    name: text("name").notNull(),
    startYear: int("start_year").notNull(),
    graduationYear: int("graduation_year").notNull(),

    school: SchoolId("school")
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

export const YearsRelations = relations(years, ({ one, many }) => ({
  school: one(schools, {
    fields: [years.school],
    references: [schools.id],
  }),
  classes: many(Classes),
}));
