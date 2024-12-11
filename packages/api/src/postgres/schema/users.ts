import { relations } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { permissionsToUsers, rolesToUsers } from "./permissions";

const USER_TYPES = ["system", "student", "teacher"] as const;
export const userType = pgEnum("user_type", USER_TYPES);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  type: userType("type").notNull(),
  email: text("email"),
  passwordHash: text("password_hash"),
  isSuperUser: boolean("is_super_user").default(false).notNull(),
  notificationKey: text("notification_key"),
});

export const UserRelations = relations(users, ({ many }) => ({
  roles: many(rolesToUsers),
  permissions: many(permissionsToUsers),
}));
