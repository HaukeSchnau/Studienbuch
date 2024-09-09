import { relations } from "drizzle-orm";
import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { PermissionsToUsers, RolesToUsers } from "../security/permissions";
import { Persons } from "./persons";

export const Users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .references(() => Persons.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  email: text("email"),
  passwordHash: text("password_hash"),
  isSuperUser: boolean("is_super_user").default(false).notNull(),
  notificationKey: text("notification_key"),
});

export const UserRelations = relations(Users, ({ one, many }) => ({
  person: one(Persons, {
    fields: [Users.id],
    references: [Persons.id],
  }),
  roles: many(RolesToUsers),
  permissions: many(PermissionsToUsers),
}));
