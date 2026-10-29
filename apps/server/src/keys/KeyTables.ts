/**
 * The key chains and recovery wrappers of accounts (recovery.md, section 7). Each row keeps the
 * `@stu/e2ee` record, statement or seal as the device sent it, in its JSON codec, beside the
 * columns the server looks it up by. The server holds public keys, signatures and sealed root keys
 * only. Deleting an account deletes all of it.
 */
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { AuthTables } from "../auth/AuthTables.ts";

export * as KeyTables from "./KeyTables.ts";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

/** One generation of an account's root key: its public keys, self-signature and link. */
export const accountKey = pgTable(
  "account_key",
  {
    accountId: text("account_id").notNull(),
    generation: integer("generation").notNull(),
    /** `AccountKey.Record`. */
    record: jsonb("record").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.generation] }),
    foreignKey({ columns: [table.accountId], foreignColumns: [AuthTables.user.id] }).onDelete(
      "cascade",
    ),
  ],
);

/** One way back to the root key: a device, a passkey's PRF output or a Notfallkarte. */
export const keyWrapper = pgTable(
  "key_wrapper",
  {
    accountId: text("account_id").notNull(),
    /** Chosen by the device that created it, unique within the account. */
    id: text("id").notNull(),
    /** `Wrapper.kindByte`. */
    kind: smallint("kind").notNull(),
    /** The passkey's credential id for a `prf` wrapper, empty for the other kinds. */
    credentialId: text("credential_id").notNull(),
    /** `Wrapper.Statement`. */
    statement: jsonb("statement").notNull(),
    /**
     * The session that added it, so a device's wrapper belongs to the device that made it. `null`
     * for what the demo seed publishes.
     */
    createdBySession: text("created_by_session"),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.id] }),
    index("key_wrapper_kind").on(table.accountId, table.kind, table.credentialId),
    index("key_wrapper_session").on(table.createdBySession),
    foreignKey({ columns: [table.accountId], foreignColumns: [AuthTables.user.id] }).onDelete(
      "cascade",
    ),
  ],
);

/** The root key of one generation, sealed to one wrapper's public key. */
export const keyWrapperSeal = pgTable(
  "key_wrapper_seal",
  {
    accountId: text("account_id").notNull(),
    wrapperId: text("wrapper_id").notNull(),
    generation: integer("generation").notNull(),
    /** `Wrapper.Seal`. */
    seal: jsonb("seal").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.wrapperId, table.generation] }),
    foreignKey({
      columns: [table.accountId, table.wrapperId],
      foreignColumns: [keyWrapper.accountId, keyWrapper.id],
    }).onDelete("cascade"),
  ],
);

/**
 * What happened to an account's keys, kept so the student can see every unlock. M1 records seal
 * fetches only, which `Keys.fetchSeals` also counts against its daily limit.
 */
export const recoveryEvent = pgTable(
  "recovery_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    /** `sealsFetched`. */
    kind: text("kind").notNull(),
    /** The kind of wrapper whose seals were fetched: `prf` or `code`. */
    method: text("method").notNull(),
    /** The passkey's credential id for `prf`. */
    credentialId: text("credential_id"),
    at: timestamp("at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("recovery_event_account").on(table.accountId, table.at),
    foreignKey({ columns: [table.accountId], foreignColumns: [AuthTables.user.id] }).onDelete(
      "cascade",
    ),
  ],
);
