import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { EVENT_TYPES } from "@stu/lib";

import { boolean, sqliteEnum, timestamp, uuid } from "./utils";

export const eventType = sqliteEnum(EVENT_TYPES);

export const events = sqliteTable("events", {
  id: uuid("id").primaryKey(),
  type: eventType("type").notNull(),
  data: text("data").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  isAppliedLocally: boolean("is_applied_locally").notNull().default(false),
  isFailed: boolean("is_failed").notNull().default(false),
});
