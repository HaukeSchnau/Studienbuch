import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { EVENT_TYPES } from "@stu/lib";

import { sqliteEnum, timestamp, uuid } from "./utils";

export const eventType = sqliteEnum(EVENT_TYPES);

const eventStatus = sqliteEnum(["pending", "error", "success"]);

export const events = sqliteTable("events", {
  id: uuid("id").primaryKey(),
  type: eventType("type").notNull(),
  data: text("data").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  publishStatus: eventStatus("publish_status").notNull(),
  localStatus: eventStatus("local_status").notNull(),
});
