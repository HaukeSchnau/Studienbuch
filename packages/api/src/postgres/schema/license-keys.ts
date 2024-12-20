import { relations } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const SchoolId = pgEnum("school_id", ["igs-lil"]);

export const licenseKeys = pgTable("license_keys", {
  key: text("key").notNull().primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  isSuperKey: boolean("is_super_key").default(false).notNull(),
  school: SchoolId("school_id"),

  activatedBy: uuid("activated_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});

export const LicenseKeyRelations = relations(licenseKeys, ({ one }) => ({
  activatedBy: one(users, {
    fields: [licenseKeys.activatedBy],
    references: [users.id],
  }),
}));
