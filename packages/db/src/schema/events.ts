import {
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { EVENT_TYPES } from "@stu/lib";

import { Users } from "./people/users";

export const eventType = pgEnum("event_type", EVENT_TYPES);

export const events = pgTable("events", {
  id: uuid().primaryKey(),
  type: eventType().notNull(),
  data: jsonb().notNull(),
  timestamp: timestamp().notNull(),
  initiator: uuid()
    .notNull()
    .references(() => Users.id),
});

export const topics = pgTable("topics", {
  id: text().primaryKey(),
});

export const eventDestinations = pgTable(
  "event_destinations",
  {
    event: uuid()
      .notNull()
      .references(() => events.id),
    topic: text().references(() => topics.id),
  },
  (table) => [
    {
      pk: primaryKey({ columns: [table.event, table.topic] }),
    },
  ],
);

export const topicSubscriptions = pgTable(
  "topic_subscriptions",
  {
    topic: text().references(() => topics.id),
    user: uuid().references(() => Users.id),
  },
  (table) => [
    {
      pk: primaryKey({ columns: [table.topic, table.user] }),
    },
  ],
);
