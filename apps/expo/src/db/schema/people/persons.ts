import { foreignKey, int, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { SALUTATIONS } from "@stu/lib";

import { Classes } from "../school/classes";
import { SchoolId } from "../school/school-id";
import { boolean, sqliteEnum, uuid } from "../utils";

export const Salutation = sqliteEnum(SALUTATIONS);

export const Persons = sqliteTable("persons", {
  id: uuid("id").primaryKey().notNull(),
  name: text("name").notNull(),
  salutation: Salutation("salutation"),
  abbrv: text("abbrv").unique(),
  email: text("email").unique(),
});

export const Students = sqliteTable(
  "students",
  {
    person: uuid("person")
      .primaryKey()
      .references(() => Persons.id),
    isOfAge: boolean("is_of_age"),

    classIdentifier: text("class_identifier").notNull(),
    startYear: int("start_year").notNull(),
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
