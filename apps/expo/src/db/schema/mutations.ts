import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { jsonb, sqliteEnum, timestamp } from "./utils";

const MutationStatus = sqliteEnum([
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "REVERTED",
]);

export const Mutations = sqliteTable("mutations", {
  timestamp: timestamp("timestamp").primaryKey(),
  path: text("path").notNull(),
  input: jsonb("input").notNull(),
  status: MutationStatus("mutation_status").notNull(),
});
