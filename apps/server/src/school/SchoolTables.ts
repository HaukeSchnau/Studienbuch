import { Tables } from "@stu/sync/server";
import { foreignKey, pgTable, primaryKey, text, timestamp, unique } from "drizzle-orm/pg-core";
import { AuthTables } from "../auth/AuthTables.ts";

export * as SchoolTables from "./SchoolTables.ts";

/**
 * Zugang: an account may use a school, through its notebook there. One per account and school, so
 * an account has one notebook per school however often it is admitted.
 */
export const schoolAccess = pgTable(
  "school_access",
  {
    accountId: text("account_id").notNull(),
    schoolId: text("school_id").notNull(),
    notebookId: text("notebook_id").notNull(),
    admittedAt: timestamp("admitted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.schoolId] }),
    unique("school_access_notebook").on(table.notebookId),
    foreignKey({ columns: [table.accountId], foreignColumns: [AuthTables.user.id] }).onDelete(
      "cascade",
    ),
    foreignKey({ columns: [table.schoolId], foreignColumns: [Tables.space.id] }),
    foreignKey({ columns: [table.notebookId], foreignColumns: [Tables.space.id] }),
  ],
);
