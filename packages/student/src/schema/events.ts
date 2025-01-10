import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { EVENT_TYPES } from "@stu/lib";

import { sqliteEnum, timestamp, uuid } from "./utils";

export const eventType = sqliteEnum(EVENT_TYPES);
const eventStatus = sqliteEnum(["PENDING", "APPLIED", "PUBLISHED", "FAILED"]);

export const events = sqliteTable(
  "events",
  {
    order: integer("order").primaryKey(),
    id: uuid("id").unique().notNull(),
    type: eventType("type").notNull(),
    data: text("data").notNull(),
    timestamp: timestamp("timestamp").notNull(),
    status: eventStatus("status").notNull(),
  },
  (table) => ({
    idIdx: index("id_idx").on(table.id),
  }),
);

export const eventsToEntities = sqliteTable(
  "events_to_entities",
  {
    event: uuid("event")
      .notNull()
      .references(() => events.id),
    entity: uuid("entity")
      .notNull()
      .references(() => entities.id),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.entity, table.event],
    }),
  }),
);

const ENTITY_TYPES = ["absence"] as const;
export const entityType = sqliteEnum(ENTITY_TYPES);

export const entities = sqliteTable("entities", {
  id: uuid("id").primaryKey(),
  type: entityType("type").notNull(),
});
