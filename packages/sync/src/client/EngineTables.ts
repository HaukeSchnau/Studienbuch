/**
 * The engine's own tables on the device, the same for every domain: drizzle-kit reads this file
 * as a second schema path next to the device schema. Their names start with `sync_` because
 * SQLite compares names without case, and a synced table named `Space` would collide.
 */
import { blob, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export * as EngineTables from "./EngineTables.ts";

/**
 * The device's own state, one row: the client id the server knows it by, the restore epoch of its
 * last pull, the last mutation id it gave a command and the last one it settled.
 */
export const sync_meta = sqliteTable("sync_meta", {
  id: integer().primaryKey(),
  client_id: text().notNull(),
  sync_epoch: text(),
  last_mutation_id: integer().notNull(),
  settled_mutation_id: integer().notNull(),
  /** 1 after a page changed base rows the overlay hasn't been replayed on yet. */
  replay_due: integer().notNull().default(0),
  /** The generation of the account's root key that `DeviceSecrets` holds as `root-key`. */
  key_generation: integer().notNull().default(0),
  /** The formats the build that started last opened sealed rows and boxes with (`Keyring.opens`). */
  opened_with: text(),
});

/**
 * The spaces the account reads, as the last pull listed them. `version` is the device's cursor,
 * `null` until the space's first patch, and `synced_at` the epoch milliseconds of that pull.
 */
export const sync_space = sqliteTable("sync_space", {
  id: text().primaryKey(),
  kind: text().notNull(),
  role: text().notNull(),
  version: integer(),
  key_epoch: integer(),
  synced_at: integer(),
});

/**
 * Commands the server hasn't settled, in plaintext: the mutator's name, version and arguments as
 * canonical JSON, and when the user acted. Only the push seals a `Seal` command.
 */
export const sync_outbox = sqliteTable("sync_outbox", {
  mutation_id: integer().primaryKey(),
  name: text().notNull(),
  version: integer().notNull(),
  args: text().notNull(),
  at: integer().notNull(),
  mode: text({ enum: ["Mutate", "Seal"] }).notNull(),
  /** A `Seal` command's rows as its last run left them, in plaintext, which the push seals. */
  writes: text(),
  /** The refusal of a `Seal` command's last run. The push sends it without rows. */
  failure: text(),
  /**
   * The `Seal` as the push first sent it, which every resend repeats byte for byte until a `Stale`
   * answer, because the server answers a different command under a used id `ClientUnknown`.
   */
  sealed: text(),
});

/**
 * The keys of encrypted spaces this device opened, one per space and key epoch. `made_here` is 1
 * for an epoch-0 key the device made itself, which it drops once the server lists an epoch.
 */
export const sync_space_key = sqliteTable(
  "sync_space_key",
  {
    space: text().notNull(),
    key_epoch: integer().notNull(),
    key: blob({ mode: "buffer" }).notNull(),
    made_here: integer().notNull().default(0),
  },
  (row) => [primaryKey({ columns: [row.space, row.key_epoch] })],
);

/**
 * Every encrypted row the device holds. An opened one names its table, so its base row can be
 * found again. A parked one keeps its envelope and ciphertext until its key arrives or an update
 * knows its format.
 */
export const sync_sealed_row = sqliteTable(
  "sync_sealed_row",
  {
    space: text().notNull(),
    id: text().notNull(),
    version: integer().notNull(),
    tbl: text(),
    envelope: text(),
    ct: blob({ mode: "buffer" }),
  },
  (row) => [primaryKey({ columns: [row.space, row.id] })],
);

/**
 * Commands the server applied, kept for 7 days after `settled_at`, so that after a restore of the
 * server's database (`Sync.EpochChanged`) the device can send them again.
 */
export const sync_settled_command = sqliteTable("sync_settled_command", {
  mutation_id: integer().primaryKey(),
  name: text().notNull(),
  version: integer().notNull(),
  args: text().notNull(),
  at: integer().notNull(),
  mode: text({ enum: ["Mutate", "Seal"] }).notNull(),
  settled_at: integer().notNull(),
});

/**
 * Commands the server refused, with its reason as JSON, until the user dismisses or redoes them.
 * Keyed by the client id they were sent under, because a new client id numbers again from 1.
 */
export const sync_rejected_command = sqliteTable(
  "sync_rejected_command",
  {
    client_id: text().notNull(),
    mutation_id: integer().notNull(),
    name: text().notNull(),
    version: integer().notNull(),
    args: text().notNull(),
    at: integer().notNull(),
    reason: text().notNull(),
  },
  (row) => [primaryKey({ columns: [row.client_id, row.mutation_id] })],
);
