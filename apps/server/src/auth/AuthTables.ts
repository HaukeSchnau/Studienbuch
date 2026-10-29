/**
 * Better Auth's tables, as `Auth.options` configures them. Better Auth writes them through its own
 * pool, so nothing but `AuthTables.test.ts` keeps these declarations and its schema in step; the
 * test compares them with `getAuthTables` on every bump. Column names are Better Auth's own.
 */
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export * as AuthTables from "./AuthTables.ts";

const createdAt = () => timestamp("createdAt", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow();

/**
 * One Studienbuch account. `name` stays empty: the display name lives in the encrypted notebook,
 * so a dump holds no student names.
 */
export const user = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** One signed-in device. Its token is the device's bearer token. */
export const session = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_session_userId_idx").on(table.userId)],
);

/** A way to sign in. Email and password is the only provider, with the password hash here. */
export const account = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("auth_account_userId_idx").on(table.userId)],
);

/** Short-lived values: email codes and passkey challenges. */
export const verification = pgTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
);

/** A registered passkey's public key. */
export const passkey = pgTable(
  "auth_passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("publicKey").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credentialID").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("deviceType").notNull(),
    backedUp: boolean("backedUp").notNull(),
    transports: text("transports"),
    createdAt: timestamp("createdAt", { withTimezone: true }),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("auth_passkey_userId_idx").on(table.userId),
    index("auth_passkey_credentialID_idx").on(table.credentialID),
  ],
);
