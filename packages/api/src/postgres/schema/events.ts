import {
  index,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

const EVENT_TYPES = ["absence.recorded", "absence.parentApproved"] as const;
export const eventType = pgEnum("event_type", EVENT_TYPES);

export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey(),
    order: serial().notNull().unique(),
    type: eventType().notNull(),
    data: json().notNull(),
    timestamp: timestamp().notNull(),
    initator: uuid()
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    {
      orderIdx: index("order_idx").on(table.order),
    },
  ],
);

export const eventsToEntities = pgTable(
  "events_to_entities",
  {
    event: uuid()
      .notNull()
      .references(() => events.id),
    entity: uuid()
      .notNull()
      .references(() => entities.id),
  },
  (table) => [
    {
      pk: primaryKey({
        columns: [table.entity, table.event],
      }),
    },
  ],
);

const ENTITY_TYPES = ["absence"] as const;
export const entityType = pgEnum("entity_type", ENTITY_TYPES);

export const entities = pgTable("entities", {
  id: uuid().primaryKey(),
  type: entityType().notNull(),
});
