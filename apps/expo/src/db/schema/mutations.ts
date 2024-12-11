import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sqliteEnum =
  <U extends string, T extends Readonly<[U, ...U[]]>>(values: T) =>
  <TName extends string>(name: TName) =>
    text(name, { enum: values });

export const timestamp = <TName extends string>(name: TName) =>
  int(name, { mode: "timestamp_ms" });

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
