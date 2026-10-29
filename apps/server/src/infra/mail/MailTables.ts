import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export * as MailTables from "./MailTables.ts";

/**
 * Mail that `MAIL_URL=capture:` kept instead of sending, for the console's mail page in
 * development and preview.
 */
export const capturedMail = pgTable(
  "captured_mail",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("captured_mail_sent_at").on(table.sentAt)],
);
