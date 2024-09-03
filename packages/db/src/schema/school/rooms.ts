import { pgTable, text } from "drizzle-orm/pg-core";

export const Rooms = pgTable("rooms", {
  roomNumber: text("room_number").primaryKey(),
  name: text("name").notNull(),
});
