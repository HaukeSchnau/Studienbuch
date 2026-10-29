/**
 * The server engine's Postgres tables. `apps/server`'s drizzle config includes this file, so
 * drizzle-kit generates their migrations with the app's (ADR 0012), and `ServerDatabase` creates
 * them in test databases.
 */
import {
  bigint,
  boolean,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export * as Tables from "./Tables.ts";

/**
 * C collation is UTF-8 byte order like SQLite's. A database created with an ICU or glibc locale
 * would otherwise list rows in another order than the device.
 */
const id = customType<{ data: string }>({ dataType: () => 'text collate "C"' });

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

/** Versions and mutation ids stay far below 2^53, so they travel as JS numbers. */
const counter = (name: string) => bigint(name, { mode: "number" });

/**
 * One row with a random id that `SyncEpoch.initialize` writes when `prepare` meets an empty
 * database. A backup restore rewrites it, so devices notice the rewind (ADR 0021).
 */
export const syncEpoch = pgTable("sync_epoch", {
  id: uuid("id").primaryKey(),
});

/** A unit of sync: a set of rows that the same accounts read. */
export const space = pgTable(
  "space",
  {
    id: id("id").primaryKey(),
    /** The `Sync.spaceKind` name. */
    kind: id("kind").notNull(),
    /**
     * The space this one belongs to, such as a course's or a notebook's school. A membership rule
     * grants a member of a notebook only spaces of the notebook's own parent, and only while the
     * member reads that parent.
     */
    parentId: id("parent_id"),
    /**
     * The id that rows in the parent use for this space, which membership rules name, such as a
     * course's id among its school's rows. Unique per parent and kind, not across parents.
     */
    key: id("key"),
    /**
     * Bumped under the row lock by every commit that writes the space, and stamped on the rows
     * that commit wrote, so version order is commit order (ADR 0019). 0 before the first write.
     */
    version: counter("version").notNull().default(0),
    /** A sealed space's current key epoch, `null` until a member's device opens epoch 0. */
    keyEpoch: integer("key_epoch"),
  },
  (table) => [
    foreignKey({ columns: [table.parentId], foreignColumns: [table.id] }),
    uniqueIndex("space_parent_kind_key").on(table.parentId, table.kind, table.key),
  ],
);

/** Who reads a space, with a role. Membership is the only read rule. */
export const spaceMember = pgTable(
  "space_member",
  {
    spaceId: id("space_id").notNull(),
    accountId: id("account_id").notNull(),
    role: id("role").notNull(),
    /**
     * The space whose rows granted the membership through a `Sync.membershipRule`, such as the
     * notebook whose `Enrollment` lists a course. `null` for memberships that server code added
     * through `Spaces`. A rule only ever removes the memberships it granted itself, and leaving a
     * parent ends the memberships its child spaces granted.
     */
    grantedBy: id("granted_by"),
  },
  (table) => [
    primaryKey({ columns: [table.spaceId, table.accountId] }),
    foreignKey({ columns: [table.spaceId], foreignColumns: [space.id] }).onDelete("cascade"),
    index("space_member_account").on(table.accountId),
    index("space_member_granted_by").on(table.grantedBy),
  ],
);

/** A device's sync identity, bound to the account that registered it. */
export const syncClient = pgTable(
  "sync_client",
  {
    id: id("id").primaryKey(),
    accountId: id("account_id").notNull(),
    /** The last command the server processed, applied or refused. Commands number from 1. */
    lastMutationId: counter("last_mutation_id").notNull(),
  },
  (table) => [index("sync_client_account").on(table.accountId)],
);

/**
 * Every synced row (ADR 0018). A readable row keeps its canonical JSON in `data`. A sealed row
 * keeps its envelope and ciphertext and an empty `tbl`, because its table travels inside the
 * ciphertext. A tombstone has neither `data` nor `ct`.
 */
export const syncRow = pgTable(
  "sync_row",
  {
    spaceId: id("space_id").notNull(),
    tbl: id("tbl").notNull(),
    id: id("id").notNull(),
    version: counter("version").notNull(),
    data: jsonb("data"),
    /** A sealed row's `SealedRow.Envelope` as the device sent it, kept for its tombstone too. */
    envelope: jsonb("envelope"),
    ct: bytea("ct"),
    /**
     * The client and command that wrote the row last, so a sealed write whose base is
     * `AfterMutation` can check that nothing wrote the row since. `null` for server writes.
     */
    writtenByClient: id("written_by_client"),
    writtenByMutation: counter("written_by_mutation"),
  },
  (table) => [
    primaryKey({ columns: [table.spaceId, table.tbl, table.id] }),
    foreignKey({ columns: [table.spaceId], foreignColumns: [space.id] }).onDelete("cascade"),
    index("sync_row_space_version").on(table.spaceId, table.version),
  ],
);

/**
 * Every command the server processed, the audit trail and the durable source of refusals: a pull
 * reads the refusals above the device's settled id from here, in the same snapshot as its rows.
 */
export const commandLog = pgTable(
  "command_log",
  {
    clientId: id("client_id").notNull(),
    mutationId: counter("mutation_id").notNull(),
    /** The connection's account. */
    accountId: id("account_id").notNull(),
    /** `Mutate` or `Seal`. */
    kind: id("kind").notNull(),
    /** The mutator's name and version for `Mutate`. `null` for `Seal`, which names no mutator. */
    name: id("name"),
    version: integer("version"),
    /**
     * `Mutate`: the arguments as sent, which only readable tables' mutators take. `Seal`: per write
     * its space, id, base, envelope, ciphertext size and SHA-256, and the boxes' and links' ids.
     * Never content.
     */
    detail: jsonb("detail").notNull(),
    applied: boolean("applied").notNull(),
    /** A refused command's `Refusal.Reason`, `null` when applied. */
    reason: jsonb("reason"),
    /** When the user acted, by the device's clock. */
    at: timestamp("at", { withTimezone: true, mode: "date" }).notNull(),
    /** When the server processed the command. */
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.clientId, table.mutationId] }),
    foreignKey({ columns: [table.clientId], foreignColumns: [syncClient.id] }).onDelete("cascade"),
  ],
);

/** Every table, in an order that creates referenced tables first. */
export const all = { syncEpoch, space, spaceMember, syncClient, syncRow, commandLog };
