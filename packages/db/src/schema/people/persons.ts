import { relations } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  pgEnum,
  pgTable,
  smallint,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { SALUTATIONS } from "@stu/lib";

import { Classes } from "../school/classes";
import { SchoolId } from "../school/school-id";

export const Salutation = pgEnum("salutation", SALUTATIONS);

export const Persons = pgTable("persons", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  salutation: Salutation("salutation"),
  abbrv: text("abbrv").unique(),
  email: text("email").unique(),
});

export const PersonsRelations = relations(Persons, ({ one }) => ({
  student: one(Students),
}));

export const Students = pgTable(
  "students",
  {
    person: uuid("person")
      .primaryKey()
      .references(() => Persons.id),
    isOfAge: boolean("is_of_age"),

    classIdentifier: text("class_identifier").notNull(),
    startYear: smallint("start_year").notNull(),
    school: SchoolId("school").notNull(),
  },
  (table) => ({
    class_fk: foreignKey({
      columns: [table.classIdentifier, table.startYear, table.school],
      foreignColumns: [
        Classes.identifierInYear,
        Classes.startYear,
        Classes.school,
      ],
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
  }),
);

export const StudentsRelations = relations(Students, ({ one }) => ({
  person: one(Persons, {
    fields: [Students.person],
    references: [Persons.id],
  }),
}));
