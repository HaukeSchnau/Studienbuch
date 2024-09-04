import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { Users } from "../people/users";
import { SchoolId } from "../school/school-id";
import { Schools } from "../school/schools";

export const LicenseKeys = pgTable("license_keys", {
  key: text("key").notNull().primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  isSuperKey: boolean("is_super_key").default(false).notNull(),
  school: SchoolId("school_id")
    .notNull()
    .references(() => Schools.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

  activatedBy: uuid("activated_by").references(() => Users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});

export const LicenseKeyRelations = relations(LicenseKeys, ({ one }) => ({
  activatedBy: one(Users, {
    fields: [LicenseKeys.activatedBy],
    references: [Users.id],
  }),
  school: one(Schools, {
    fields: [LicenseKeys.school],
    references: [Schools.id],
  }),
}));
