import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Enquiries from the "Für Schulen" form.
 *
 * Deliberately four fields. A school asking for a conversation should not have to hand over more
 * than the conversation needs, and every extra column here is personal data we would have to
 * justify, secure and eventually delete.
 *
 * The row is written before anyone is notified, so a failure to deliver the notification can never
 * lose the enquiry — the worst case is that it has to be read out of the table.
 */
export const schoolEnquiries = pgTable(
  "school_enquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolName: text("schoolName").notNull(),
    contactName: text("contactName").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    receivedAt: timestamp("receivedAt", { withTimezone: true }).defaultNow().notNull(),
    /** Set once the enquiry has been announced, so a later channel can find what it missed. */
    notifiedAt: timestamp("notifiedAt", { withTimezone: true }),
  },
  (table) => [index("school_enquiries_received_idx").on(table.receivedAt)],
);
