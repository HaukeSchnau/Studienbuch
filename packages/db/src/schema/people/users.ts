import { relations } from "drizzle-orm";
import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { PermissionsToUsers, RolesToUsers } from "../security/permissions";
import { Persons } from "./persons";

export const Users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .references(() => Persons.id),
  email: text("email"),
  passwordHash: text("password_hash"),
  isSuperUser: boolean("is_super_user").default(false).notNull(),
  notificationKeys: text("notification_keys").array(),
});

export const UserRelations = relations(Users, ({ many }) => ({
  roles: many(RolesToUsers),
  permissions: many(PermissionsToUsers),
}));
