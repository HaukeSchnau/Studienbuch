import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { STATE_CODES } from "@stu/lib";

import { sqliteEnum } from "../utils";
import { SchoolId } from "./school-id";
import { semesters } from "./semesters";
import { years } from "./years";

export const StateCode = sqliteEnum(STATE_CODES);

export const schools = sqliteTable("schools", {
  id: SchoolId("id").primaryKey().notNull(),
  name: text("name").notNull(),
  stateCode: StateCode("state_code").notNull(),
});

export const SchoolRelations = relations(schools, ({ many }) => ({
  years: many(years),
  semesters: many(semesters),
}));
