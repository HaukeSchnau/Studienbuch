import { jsonb, pgTable, uuid } from "drizzle-orm/pg-core";
// eslint-disable-next-line import/no-extraneous-dependencies -- just a type, maybe fix later
import type { ExpoPushTicket } from "expo-server-sdk";

export const notificationTickets = pgTable("notification_tickets", {
  id: uuid().primaryKey(),
  ticket: jsonb().$type<ExpoPushTicket>().notNull(),
});
