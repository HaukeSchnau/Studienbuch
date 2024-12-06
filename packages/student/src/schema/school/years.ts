import { relations } from "drizzle-orm";
import { int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { Classes } from "./classes";
import { SchoolId } from "./school-id";
import { Schools } from "./schools";

export const Years = sqliteTable(
  "years",
  {
    name: text("name").notNull(),
    startYear: int("start_year").notNull(),
    graduationYear: int("graduation_year").notNull(),

    school: SchoolId("school")
      .notNull()
      .references(() => Schools.id, {
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

export const YearsRelations = relations(Years, ({ one, many }) => ({
  school: one(Schools, {
    fields: [Years.school],
    references: [Schools.id],
  }),
  classes: many(Classes),
}));
