import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { STATE_CODES } from "@stu/lib";

import { sqliteEnum } from "../utils";
import { SchoolId } from "./school-id";
import { Semesters } from "./semesters";
import { Years } from "./years";

export const StateCode = sqliteEnum(STATE_CODES);

export const Schools = sqliteTable("schools", {
  id: SchoolId("id").primaryKey().notNull(),
  name: text("name").notNull(),
  stateCode: StateCode("state_code").notNull(),
});

export const SchoolRelations = relations(Schools, ({ many }) => ({
  years: many(Years),
  semesters: many(Semesters),
}));
