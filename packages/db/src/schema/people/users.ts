import { relations } from "drizzle-orm";
import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { PermissionsToUsers, RolesToUsers } from "../security/permissions";

export const Users = pgTable("users", {
  id: uuid("id").primaryKey().notNull(),
  email: text("email"),
  passwordHash: text("password_hash"),
  isSuperUser: boolean("is_super_user").default(false).notNull(),
  notificationTokens: text("notification_tokens").array().notNull().default([]),
});

export const UserRelations = relations(Users, ({ many }) => ({
  roles: many(RolesToUsers),
  permissions: many(PermissionsToUsers),
}));
