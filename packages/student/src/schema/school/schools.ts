import { STATE_CODES } from "@stu/lib";
import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEnum } from "../utils";
import { schoolId } from "./school-id";
import { semesters } from "./semesters";
import { years } from "./years";

export const stateCode = sqliteEnum(STATE_CODES);

export const schools = sqliteTable("schools", {
  id: schoolId("id").primaryKey().notNull(),
  name: text("name").notNull(),
  stateCode: stateCode("state_code").notNull(),
});

export const schoolRelations = relations(schools, ({ many }) => ({
  years: many(years),
  semesters: many(semesters),
}));
