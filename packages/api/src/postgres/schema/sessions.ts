import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const sessions = pgTable("sessions", {
  user: uuid("user")
    .references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    })
    .notNull(),
  expires: timestamp("expires", { precision: 3, mode: "date" }).notNull(),
  token: text("token").primaryKey().notNull(),
});

export const SessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.user],
    references: [users.id],
  }),
}));
