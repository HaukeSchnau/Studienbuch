import { sqliteTable, text } from "drizzle-orm/sqlite-core";

import { sqliteEnum, timestamp } from "./utils";

const MutationStatus = sqliteEnum([
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "REVERTED",
]);

export const Mutations = sqliteTable("mutations", {
  timestamp: timestamp("timestamp").primaryKey(),
  path: text("path").notNull(),
  input: text("input").notNull(),
  status: MutationStatus("mutation_status").notNull(),
});
