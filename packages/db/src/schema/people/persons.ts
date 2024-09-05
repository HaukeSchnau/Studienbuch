import { pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { SALUTATIONS } from "@stu/lib";

import { PrimaryRole } from "./users";

export const Salutation = pgEnum("salutation", SALUTATIONS);

export const Persons = pgTable("persons", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  salutation: Salutation("salutation"),
  abbrv: text("abbrv").unique(),
  email: text("email").unique(),
  role: PrimaryRole("role"),
});
