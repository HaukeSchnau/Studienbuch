import { relations } from "drizzle-orm";
import { foreignKey, int, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { persons } from "../people/persons";
import { uuid } from "../utils";
import { coursesToClasses } from "./courses";
import { schoolId } from "./school-id";
import { years } from "./years";

export const classes = sqliteTable(
  "classes",
  {
    identifierInYear: text("identifier_in_year").notNull(),

    startYear: int("start_year").notNull(),
    school: schoolId("school").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.identifierInYear, table.startYear, table.school],
      }),
      year_fk: foreignKey({
        columns: [table.startYear, table.school],
        foreignColumns: [years.startYear, years.school],
      })
        .onDelete("restrict")
        .onUpdate("cascade"),
    };
  },
);

export const classesRelations = relations(classes, ({ one, many }) => ({
  year: one(years, {
    fields: [classes.startYear, classes.school],
    references: [years.startYear, years.school],
  }),
  teachers: many(teachersToClasses),
  courses: many(coursesToClasses),
}));

export const teachersToClasses = sqliteTable(
  "teachers_to_classes",
  {
    teacher: uuid("teacher")
      .notNull()
      .references(() => persons.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    classIdentifier: text("class_identifier").notNull(),
    classStartYear: int("class_start_year").notNull(),
    school: schoolId("school").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.teacher, table.classIdentifier, table.classStartYear, table.school],
      }),
      class_fk: foreignKey({
        columns: [table.classIdentifier, table.classStartYear, table.school],
        foreignColumns: [classes.identifierInYear, classes.startYear, classes.school],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const teachersToClassesRelations = relations(teachersToClasses, ({ one }) => ({
  teacher: one(persons, {
    fields: [teachersToClasses.teacher],
    references: [persons.id],
  }),
  class: one(classes, {
    fields: [teachersToClasses.classIdentifier, teachersToClasses.classStartYear, teachersToClasses.school],
    references: [classes.identifierInYear, classes.startYear, classes.school],
  }),
}));
