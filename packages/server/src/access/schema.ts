import type { Organization } from "@stu/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "../auth/schema.ts";

const timestamps = {
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

/** A Studienbuch tenant. It exists independently of any provider directory import. */
export const schools = pgTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

/** An unassigned code from a printable school pool. Only its digest reaches PostgreSQL. */
export const schoolAccessCodes = pgTable(
  "school_access_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: text("schoolId")
      .notNull()
      .references(() => schools.id),
    kind: text("kind").$type<Organization.SchoolAccessKind>().notNull(),
    secretHash: text("secretHash").notNull(),
    createdByUserId: uuid("createdByUserId")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expiresAt", { withTimezone: true }),
    revokedAt: timestamp("revokedAt", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("school_access_codes_secret_unique").on(table.secretHash),
    index("school_access_codes_school_idx").on(table.schoolId, table.kind),
  ],
);

/**
 * A short-lived claim which removes one code from circulation while signup is in progress.
 * Redeemed claims remain as a token-to-code receipt so completion is safe to retry.
 */
export const schoolAccessReservations = pgTable(
  "school_access_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accessCodeId: uuid("accessCodeId")
      .notNull()
      .references(() => schoolAccessCodes.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("school_access_reservations_code_unique").on(table.accessCodeId),
    uniqueIndex("school_access_reservations_token_unique").on(table.tokenHash),
    index("school_access_reservations_expiry_idx").on(table.expiresAt),
  ],
);

/** School-scoped product access. It is not an authoritative school directory membership. */
export const schoolAccesses = pgTable(
  "school_accesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: text("schoolId")
      .notNull()
      .references(() => schools.id),
    kind: text("kind").$type<Organization.SchoolAccessKind>().notNull(),
    sourceCodeId: uuid("sourceCodeId")
      .notNull()
      .references(() => schoolAccessCodes.id),
    revokedAt: timestamp("revokedAt", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("school_accesses_source_code_unique").on(table.sourceCodeId),
    uniqueIndex("school_accesses_active_identity_unique")
      .on(table.userId, table.schoolId, table.kind)
      .where(sql`${table.revokedAt} is null`),
    index("school_accesses_user_idx").on(table.userId),
    index("school_accesses_school_idx").on(table.schoolId, table.kind),
  ],
);

/** The notebook identity a user chose for one school access record. */
export const notebookProfiles = pgTable("notebook_profiles", {
  schoolAccessId: uuid("schoolAccessId")
    .primaryKey()
    .references(() => schoolAccesses.id, { onDelete: "cascade" }),
  displayName: text("displayName").notNull(),
  cohort: text("cohort"),
  className: text("className"),
  ...timestamps,
});

/** Global platform authority, deliberately unrelated to a school role. */
export const operatorGrants = pgTable(
  "operator_grants",
  {
    userId: uuid("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    revokedAt: timestamp("revokedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("operator_grants_active_idx").on(table.revokedAt)],
);

/** One passkey-registration ceremony for an operator created by the console. */
export const operatorSetupTokens = pgTable(
  "operator_setup_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    usedAt: timestamp("usedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("operator_setup_tokens_secret_unique").on(table.tokenHash),
    index("operator_setup_tokens_user_idx").on(table.userId),
  ],
);

/** Better Auth's passkey plugin model. Field names are part of its adapter contract. */
export const passkey = pgTable(
  "passkey",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name"),
    publicKey: text("publicKey").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialID: text("credentialID").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("deviceType").notNull(),
    backedUp: boolean("backedUp").notNull(),
    transports: text("transports"),
    createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow(),
    aaguid: text("aaguid"),
  },
  (table) => [
    uniqueIndex("passkey_credential_unique").on(table.credentialID),
    index("passkey_user_id_idx").on(table.userId),
  ],
);
