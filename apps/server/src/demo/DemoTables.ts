import { foreignKey, pgTable, text } from "drizzle-orm/pg-core";
import { AuthTables } from "../auth/AuthTables.ts";

export * as DemoTables from "./DemoTables.ts";

/**
 * The demo accounts, the only ones whose root key the server derives and that persona sign-in
 * reaches (invariant 14). Only the seed and the console write it.
 */
export const demoAccount = pgTable(
  "demo_account",
  {
    accountId: text("account_id").primaryKey(),
    /** Such as `lena`, which `Demo.signIn` names. */
    persona: text("persona").notNull().unique(),
  },
  (table) => [
    foreignKey({ columns: [table.accountId], foreignColumns: [AuthTables.user.id] }).onDelete(
      "cascade",
    ),
  ],
);
