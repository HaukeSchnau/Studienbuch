import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { Users } from "../people/users";

export const Sessions = pgTable("sessions", {
  user: uuid("user").references(() => Users.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  expires: timestamp("expires", { precision: 3, mode: "date" }).notNull(),
  token: text("token").primaryKey().notNull(),
});

export const SessionRelations = relations(Sessions, ({ one }) => ({
  user: one(Users, {
    fields: [Sessions.user],
    references: [Users.id],
  }),
}));
