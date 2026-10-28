import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * One row with a random id written when the database is created. A backup restore rewrites it, so
 * devices notice the rewind (sync.md, "Backup restores and the epoch").
 */
export const syncEpoch = pgTable("sync_epoch", {
  id: uuid("id").primaryKey(),
});

/** When each scheduled job last ran, for readiness. */
export const jobRun = pgTable("job_run", {
  name: text("name").primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: "date" }).notNull(),
});

export * as Schema from "./Schema.ts";
