import {
  customType,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import superjson from "superjson";

import { EVENT_TYPES } from "@stu/lib";

import { Users } from "./people/users";

const superjsonb = customType<{ data: unknown }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return superjson.stringify(value);
  },
  fromDriver(value) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    return superjson.deserialize(value as any);
  },
});

export const eventType = pgEnum("event_type", EVENT_TYPES);

export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey(),
    type: eventType().notNull(),
    data: superjsonb("data").notNull(),
    timestamp: timestamp().notNull(),
    initiator: uuid()
      .notNull()
      .references(() => Users.id),
  },
  (table) => [
    {
      idx_timestamp: index().on(table.timestamp),
    },
  ],
);

export const eventTopics = pgTable(
  "event_topics",
  {
    event: uuid()
      .notNull()
      .references(() => events.id),
    topic: text().notNull(),
  },
  (table) => [
    {
      pk: primaryKey({ columns: [table.event, table.topic] }),
      idx_event_topics: index().on(table.event, table.topic),
    },
  ],
);

export const eventsSentToUsers = pgTable(
  "events_sent_to_users",
  {
    event: uuid().references(() => events.id),
    user: uuid().references(() => Users.id),
  },
  (table) => [
    {
      pk: primaryKey({ columns: [table.event, table.user] }),
      idx_event_user: index().on(table.event, table.user),
    },
  ],
);
