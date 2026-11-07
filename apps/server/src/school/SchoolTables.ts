import { Tables } from "@stu/sync/server";
import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { AuthTables } from "../auth/AuthTables.ts";

export * as SchoolTables from "./SchoolTables.ts";

/**
 * Zugang: an account may use a school, through its notebook there. One per account and school, so
 * an account has one notebook per school however often it is admitted.
 */
export const schoolAccess = pgTable(
  "school_access",
  {
    accountId: text("account_id").notNull(),
    schoolId: text("school_id").notNull(),
    notebookId: text("notebook_id").notNull(),
    admittedAt: timestamp("admitted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.schoolId] }),
    unique("school_access_notebook").on(table.notebookId),
    foreignKey({ columns: [table.accountId], foreignColumns: [AuthTables.user.id] }).onDelete(
      "cascade",
    ),
    foreignKey({ columns: [table.schoolId], foreignColumns: [Tables.space.id] }),
    foreignKey({ columns: [table.notebookId], foreignColumns: [Tables.space.id] }),
  ],
);

/**
 * Zugangscode: admits accounts of one kind to a school. Only the code's SHA-256 reaches the
 * database. `maxUses` null means any number of sign-ups, as the demo school's code on previews.
 */
export const accessCode = pgTable(
  "access_code",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: text("school_id").notNull(),
    kind: text("kind").notNull(),
    secretHash: text("secret_hash").notNull().unique(),
    maxUses: integer("max_uses"),
    /** Admissions so far. A use counts when the confirmed address admits the account. */
    uses: integer("uses").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("access_code_school").on(table.schoolId),
    foreignKey({ columns: [table.schoolId], foreignColumns: [Tables.space.id] }),
  ],
);

/**
 * A held use of a code while a sign-up is under way, named by a random token the device keeps.
 * `signUps` counts the accounts the token created, at most a few, so a mistyped address can be
 * corrected but a leaked token mints no stream of accounts and mail. A reservation is spent once,
 * by the first of its accounts to confirm its address.
 */
export const accessReservation = pgTable(
  "access_reservation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    signUps: integer("sign_ups").notNull().default(0),
    spentAt: timestamp("spent_at", { withTimezone: true, mode: "date" }),
    spentBy: text("spent_by"),
  },
  (table) => [
    index("access_reservation_code").on(table.codeId),
    foreignKey({ columns: [table.codeId], foreignColumns: [accessCode.id] }).onDelete("cascade"),
  ],
);

/**
 * The reservations sign-ups for an account's address carried, until the address is confirmed.
 * Anyone may sign up any address, so the confirming device names which of them admits it.
 */
export const accessSignUp = pgTable(
  "access_sign_up",
  {
    accountId: text("account_id").notNull(),
    reservationId: uuid("reservation_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.reservationId] }),
    foreignKey({ columns: [table.accountId], foreignColumns: [AuthTables.user.id] }).onDelete(
      "cascade",
    ),
    foreignKey({
      columns: [table.reservationId],
      foreignColumns: [accessReservation.id],
    }).onDelete("cascade"),
  ],
);
