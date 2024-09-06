import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const Rooms = sqliteTable("rooms", {
  roomNumber: text("room_number").primaryKey(),
  name: text("name").notNull(),
});
