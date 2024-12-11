import { pgTable, uuid } from "drizzle-orm/pg-core";

import { Users } from "./people/users";

export const Events = pgTable("events", {
  id: uuid("id").primaryKey().notNull(),
  initiator: uuid("initiator").references(() => Users.id, {
    onDelete: "set null",
    onUpdate: "set null",
  }),
});
