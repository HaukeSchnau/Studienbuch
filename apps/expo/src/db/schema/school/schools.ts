import { relations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { STATE_CODES } from "@stu/lib";

import { jsonb, sqliteEnum } from "../utils";
import { SchoolId } from "./school-id";
import { Semesters } from "./semesters";
import { Years } from "./years";

export const StateCode = sqliteEnum(STATE_CODES);

export const Schools = sqliteTable("schools", {
  id: SchoolId("id").primaryKey().notNull(),
  name: text("name").notNull(),
  image: text("image").notNull(),
  theme: jsonb("theme").notNull(),
  stateCode: StateCode("state_code").notNull(),
  kadmosName: text("kadmos_name").notNull(),
  kadmosUsername: text("kadmos_username").notNull(),
  kadmosPassword: text("kadmos_password").notNull(),
});

export const SchoolRelations = relations(Schools, ({ many }) => ({
  years: many(Years),
  semesters: many(Semesters),
}));
