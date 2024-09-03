import { relations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { PermissionsToUsers, RolesToUsers } from "../security/permissions";
import { Persons } from "./persons";

export const PrimaryRole = pgEnum("primary_role", ["TEACHER", "STUDENT"]);

export const Users = pgTable("users", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: text("email"),
  passwordHash: text("password_hash"),
  isSuperUser: boolean("is_super_user").default(false).notNull(),
  primaryRole: PrimaryRole("primary_role"),
  notificationKey: text("notification_key"),
  person: uuid("person")
    .notNull()
    .unique()
    .references(() => Persons.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
});

export const UserRelations = relations(Users, ({ one, many }) => ({
  person: one(Persons, {
    fields: [Users.person],
    references: [Persons.id],
  }),
  roles: many(RolesToUsers),
  permissions: many(PermissionsToUsers),
}));
