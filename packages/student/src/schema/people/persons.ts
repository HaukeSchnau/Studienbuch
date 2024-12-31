import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { SALUTATIONS } from "@stu/lib";

import { sqliteEnum, uuid } from "../utils";

export const salutation = sqliteEnum(SALUTATIONS);

export const persons = sqliteTable("persons", {
  id: uuid("id").primaryKey().notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  salutation: salutation("salutation"),
  abbrv: text("abbrv").unique(),
  email: text("email").unique(),
});
