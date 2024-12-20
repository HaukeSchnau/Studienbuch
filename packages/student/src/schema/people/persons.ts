import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { SALUTATIONS } from "@stu/lib";

import { sqliteEnum, uuid } from "../utils";

export const Salutation = sqliteEnum(SALUTATIONS);

export const persons = sqliteTable("persons", {
  id: uuid("id").primaryKey().notNull(),
  name: text("name").notNull(),
  salutation: Salutation("salutation"),
  abbrv: text("abbrv").unique(),
  email: text("email").unique(),
});
