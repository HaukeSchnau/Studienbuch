import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** When each scheduled job last ran, for readiness. */
export const jobRun = pgTable("job_run", {
  name: text("name").primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: "date" }).notNull(),
});

export * as Schema from "./Schema.ts";
