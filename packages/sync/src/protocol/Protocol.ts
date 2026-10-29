/**
 * The sync RPCs, on one WebSocket per device (`Connection`) with JSON frames. The server deploys
 * before clients, so messages change additively: older clients ignore new fields, a new member of
 * a union the server sends reaches only clients whose contract version knows it, and a removed or
 * renamed field needs a new RPC name.
 */
import { SealedRow } from "@stu/e2ee";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";
import { Sync } from "../definition/Sync.ts";
import { Command } from "./Command.ts";
import { Ids } from "./Ids.ts";
import { Refusal } from "./Refusal.ts";

export * as Protocol from "./Protocol.ts";

// What fails a whole push or pull

/** The push skipped mutation ids. The device sends again from `expected` and nothing newer. */
export class OutOfOrder extends Schema.TaggedError<OutOfOrder, { readonly brand: unique symbol }>()(
  "Sync.OutOfOrder",
  { expected: Ids.MutationId },
) {}

/**
 * The server's database came back from a backup. The device drops its base rows, moves its
 * settled commands above `lastMutationId` back into the outbox and pulls every space again.
 */
export class EpochChanged extends Schema.TaggedError<
  EpochChanged,
  { readonly brand: unique symbol }
>()("Sync.EpochChanged", { syncEpoch: Ids.SyncEpoch, lastMutationId: Ids.LastMutationId }) {}

/**
 * The client's contract version is below `minimum`. The device keeps working on its own data
 * and keeps its outbox until the app updates.
 */
export class UpdateRequired extends Schema.TaggedError<
  UpdateRequired,
  { readonly brand: unique symbol }
>()("Sync.UpdateRequired", { minimum: Schema.Int }) {}

/**
 * The server doesn't know this client for this account: it was unseen for a year, or another
 * account registered it. The device registers a new client id and renumbers its outbox from 1.
 */
export class ClientUnknown extends Schema.TaggedError<
  ClientUnknown,
  { readonly brand: unique symbol }
>()("Sync.ClientUnknown", {}) {}

/** Another device of the account removed this one. The device wipes its data and keys. */
export class DeviceRevoked extends Schema.TaggedError<
  DeviceRevoked,
  { readonly brand: unique symbol }
>()("Sync.DeviceRevoked", {}) {}

/** What every push and pull starts with. */
const client = {
  /** Generated on the device when it first syncs, and bound to the account that registered it. */
  clientId: Ids.Id,
  /** The restore epoch from the device's last pull, `null` before its first. */
  syncEpoch: Schema.NullOr(Ids.SyncEpoch),
  contract: Sync.Contract,
};

// Push

/**
 * The commands from the first one the server hasn't confirmed, in mutation id order. The server
 * applies each in its own transaction and stops at the first `Retry` or `Stale`.
 */
export const PushRequest = Schema.Struct({ ...client, commands: Schema.Array(Command.Any) });

export type PushRequest = typeof PushRequest.Type;

/** The command's effect is on the server. */
export const Applied = Schema.TaggedStruct("Applied", { mutationId: Ids.MutationId });

/** The command is processed without effect. The pull delivers the reason again, durably. */
export const Rejected = Schema.TaggedStruct("Rejected", {
  mutationId: Ids.MutationId,
  reason: Refusal.Reason,
});

/**
 * Not processed: the database was unavailable, or the mutator version is newer than the
 * server's. The device sends it again later.
 */
export const Retry = Schema.TaggedStruct("Retry", { mutationId: Ids.MutationId });

/**
 * Not processed: a sealed write's base or key epoch is no longer current. The device pulls,
 * replays and seals the command again.
 */
export const Stale = Schema.TaggedStruct("Stale", { mutationId: Ids.MutationId });

export const Outcome = Schema.Union([Applied, Rejected, Retry, Stale]);

export type Outcome = typeof Outcome.Type;

export const PushResponse = Schema.Struct({
  lastMutationId: Ids.LastMutationId,
  /** One per processed command, a command processed before included. */
  outcomes: Schema.Array(Outcome),
});

export type PushResponse = typeof PushResponse.Type;

export const PushError = Schema.Union([
  OutOfOrder,
  EpochChanged,
  UpdateRequired,
  ClientUnknown,
  DeviceRevoked,
]);

// Pull

/** A space and the version a device holds it at, or a space's version a poke announces. */
export const Cursor = Schema.Struct({ space: Ids.Id, version: Ids.Version });

export const PullRequest = Schema.Struct({
  ...client,
  /** The spaces the device wants, with what it holds. A space without a cursor comes whole. */
  cursors: Schema.Array(Cursor),
  /** The device has moved every refusal up to here out of its outbox. */
  settledMutationId: Ids.LastMutationId,
  /** Rows per response at most. The server cuts at a version, so no commit arrives in parts. */
  limit: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});

export type PullRequest = typeof PullRequest.Type;

/** A space the account reads now. */
export const Space = Schema.Struct({
  id: Ids.Id,
  kind: Ids.Name,
  role: Ids.Name,
  version: Ids.Version,
  /** The current key epoch of a sealed space, `null` before its first and in readable spaces. */
  keyEpoch: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
});

/** A readable row's JSON as the server stores it, fields this app version doesn't know included. */
export const Readable = Schema.TaggedStruct("Readable", { data: Schema.Json });

/** An encrypted row. Its table name travels inside the ciphertext. */
export const Sealed = Schema.TaggedStruct("Sealed", {
  envelope: SealedRow.Envelope,
  ct: Schema.Uint8Array,
});

/** A tombstone. */
export const Deleted = Schema.TaggedStruct("Deleted", {});

/** In a sealed space, the `Readable` rows of this table are its key boxes (`SpaceKey.KeyBox`). */
export const keyBoxTable = "_key";

/** In a sealed space, the `Readable` rows of this table are its history links (`SpaceKey.HistoryLink`). */
export const historyLinkTable = "_keychain";

export const Op = Schema.Struct({
  /** The table, empty for an encrypted row, whose table only the device sees. */
  tbl: Schema.String,
  id: Ids.Id,
  version: Ids.Version,
  row: Schema.Union([Readable, Sealed, Deleted]),
});

export type Op = typeof Op.Type;

export const Patch = Schema.Struct({
  space: Ids.Id,
  /** The device replaces its rows of the space: it had no cursor, or one below the purged floor. */
  reset: Schema.Boolean,
  /** The device's cursor for the space after this patch. */
  to: Ids.Version,
  ops: Schema.Array(Op),
});

export type Patch = typeof Patch.Type;

/** A refusal of the device's own command, read with the rows from one snapshot. */
export const Refused = Schema.Struct({ mutationId: Ids.MutationId, reason: Refusal.Reason });

export const PullResponse = Schema.Struct({
  syncEpoch: Ids.SyncEpoch,
  /** Every space the account reads, whether the device asked for it or not. */
  spaces: Schema.Array(Space),
  patches: Schema.Array(Patch),
  /** Spaces the account no longer reads. The device deletes their rows. */
  removed: Schema.Array(Ids.Id),
  /**
   * The client's last processed command, on the last page only, so it never leads the rows. The
   * device settles its outbox up to here.
   */
  lastMutationId: Schema.NullOr(Ids.LastMutationId),
  /** Refusals between the request's `settledMutationId` and `lastMutationId`. */
  refusals: Schema.Array(Refused),
  /** Another page follows. The device pulls again with its new cursors. */
  more: Schema.Boolean,
});

export type PullResponse = typeof PullResponse.Type;

export const PullError = Schema.Union([EpochChanged, UpdateRequired, ClientUnknown, DeviceRevoked]);

// Events

/** Spaces the account reads advanced, after the commit. A hint only: the device pulls. */
export const Poke = Schema.TaggedStruct("Poke", { spaces: Schema.Array(Cursor) });

/** The account's memberships changed. The device pulls to see its new spaces. */
export const AccountChanged = Schema.TaggedStruct("AccountChanged", {});

export const Event = Schema.Union([Poke, AccountChanged]);

export type Event = typeof Event.Type;

export const Rpcs = RpcGroup.make(
  Rpc.make("Sync.push", { payload: PushRequest, success: PushResponse, error: PushError }),
  Rpc.make("Sync.pull", { payload: PullRequest, success: PullResponse, error: PullError }),
  Rpc.make("Sync.events", {
    payload: { contract: Sync.Contract },
    success: Event,
    stream: true,
  }),
);
