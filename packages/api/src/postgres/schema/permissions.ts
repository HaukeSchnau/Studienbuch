import { relations } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

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

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull().unique(),
  defaultScope: jsonb("default_scope"),
});

export const rolesToUsers = pgTable(
  "roles_to_users",
  {
    role: uuid("role")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade", onUpdate: "cascade" }),
    user: uuid("user")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (table) => [
    {
      pk: primaryKey({
        columns: [table.role, table.user],
      }),
    },
  ],
);

export const RolesToUsersRelations = relations(rolesToUsers, ({ one }) => ({
  role: one(roles, {
    fields: [rolesToUsers.role],
    references: [roles.id],
  }),
  user: one(users, {
    fields: [rolesToUsers.user],
    references: [users.id],
  }),
}));

export const permissionsToUsers = pgTable(
  "permissions_to_users",
  {
    permission: Permission("permission").notNull(),
    user: uuid("user")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    scope: jsonb("scope"),
  },
  (table) => [
    {
      pk: primaryKey({
        columns: [table.permission, table.user],
      }),
    },
  ],
);

export const PermissionsToUsersRelations = relations(
  permissionsToUsers,
  ({ one }) => ({
    user: one(users, {
      fields: [permissionsToUsers.user],
      references: [users.id],
    }),
  }),
);

export const permissionsToRoles = pgTable(
  "permissions_to_roles",
  {
    permission: Permission("permission").notNull(),
    role: uuid("role")
      .notNull()
      .references(() => roles.id, {
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
