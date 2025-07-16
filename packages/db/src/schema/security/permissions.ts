import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { Users } from "../people/users";

export const PERMISSIONS = [
  "EDIT_INFO_PAGES",
  "EDIT_USERS",
  "EDIT_COURSES",
  "EDIT_YEARS",
  "EDIT_CLASSES",
  "EDIT_SCHOOLS",
  "VIEW_LOGS",
] as const;

export const Permission = pgEnum("permission", PERMISSIONS);

export const Roles = pgTable("roles", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull().unique(),
  defaultScope: jsonb("default_scope"),
});

export const RolesToUsers = pgTable(
  "roles_to_users",
  {
    role: uuid("role")
      .notNull()
      .references(() => Roles.id, { onDelete: "cascade", onUpdate: "cascade" }),
    user: uuid("user")
      .notNull()
      .references(() => Users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.role, table.user],
      }),
    };
  },
);

export const RolesToUsersRelations = relations(RolesToUsers, ({ one }) => ({
  role: one(Roles, {
    fields: [RolesToUsers.role],
    references: [Roles.id],
  }),
  user: one(Users, {
    fields: [RolesToUsers.user],
    references: [Users.id],
  }),
}));

export const PermissionsToUsers = pgTable(
  "permissions_to_users",
  {
    permission: Permission("permission").notNull(),
    user: uuid("user")
      .notNull()
      .references(() => Users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    scope: jsonb("scope"),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.permission, table.user],
      }),
    };
  },
);

export const PermissionsToUsersRelations = relations(PermissionsToUsers, ({ one }) => ({
  user: one(Users, {
    fields: [PermissionsToUsers.user],
    references: [Users.id],
  }),
}));

export const PermissionsToRoles = pgTable(
  "permissions_to_roles",
  {
    permission: Permission("permission").notNull(),
    role: uuid("role")
      .notNull()
      .references(() => Roles.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    scope: jsonb("scope"),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.permission, table.role],
      }),
    };
  },
);
