import { relations } from "drizzle-orm";
import { foreignKey, int, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { SALUTATIONS } from "@stu/lib";

import { classes } from "../school/classes";
import { schoolId } from "../school/school-id";
import { schools } from "../school/schools";
import { years } from "../school/years";
import { boolean, sqliteEnum, uuid } from "../utils";

export const salutation = sqliteEnum(SALUTATIONS);

export const persons = sqliteTable("persons", {
  id: uuid("id").primaryKey().notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  salutation: salutation("salutation"),
  abbrv: text("abbrv").unique(),
  email: text("email").unique(),
});

export const personRelations = relations(persons, ({ one }) => ({
  student: one(students, {
    fields: [persons.id],
    references: [students.person],
  }),
}));

export const students = sqliteTable(
  "students",
  {
    person: uuid("person")
      .references(() => persons.id)
      .primaryKey(),
    isOfAge: boolean("is_of_age"),

    classIdentifier: text("class_identifier").notNull(),
    startYear: int("start_year").notNull(),
    school: schoolId("school").notNull(),
  },
  (table) => ({
    class_fk: foreignKey({
      columns: [table.classIdentifier, table.startYear, table.school],
      foreignColumns: [classes.identifierInYear, classes.startYear, classes.school],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
  }),
);

export const studentRelations = relations(students, ({ one }) => ({
  person: one(persons, {
    fields: [students.person],
    references: [persons.id],
  }),
  class: one(classes, {
    fields: [students.classIdentifier, students.startYear, students.school],
    references: [classes.identifierInYear, classes.startYear, classes.school],
  }),
  year: one(years, {
    fields: [students.startYear, students.school],
    references: [years.startYear, years.school],
  }),
  school: one(schools, {
    fields: [students.school],
    references: [schools.id],
  }),
}));
