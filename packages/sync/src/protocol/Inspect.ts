/**
 * `Sync.inspect`: what the server holds of some spaces and clients, for the Sync Lab's server
 * panel. Only development and preview servers answer it. An encrypted row shows its envelope and
 * the size of its ciphertext, never the ciphertext itself.
 */
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import * as Schema from "effect/Schema";
import { Ids } from "./Ids.ts";
import { Refusal } from "./Refusal.ts";

export * as Inspect from "./Inspect.ts";

/** Effect RPC over HTTP `POST`, on the server's own origin. */
export const path = "/api/sync/inspect";

/** The wire format of `path`. Client and server provide this same layer. */
export const serialization = RpcSerialization.layerNdjson;

export const Request = Schema.Struct({
  spaces: Schema.Array(Ids.Id),
  /** The clients whose commands to show, newest first. */
  clients: Schema.Array(Ids.Id),
  /** Rows per space and commands per client at most, newest first. */
  limit: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1000 })),
});

export type Request = typeof Request.Type;

export const Member = Schema.Struct({
  account: Ids.Id,
  role: Ids.Name,
  /** The space whose rows granted the membership through a rule, `null` for the server's own. */
  grantedBy: Schema.NullOr(Ids.Id),
});

export const Space = Schema.Struct({
  id: Ids.Id,
  kind: Ids.Name,
  /** The space it belongs to, such as a course's or a notebook's school. */
  parent: Schema.NullOr(Ids.Id),
  /** Its id among the parent's rows, which membership rules name. */
  key: Schema.NullOr(Ids.Id),
  version: Ids.Version,
  keyEpoch: Schema.NullOr(Schema.Int),
  members: Schema.Array(Member),
});

export type Space = typeof Space.Type;

/** A readable row's JSON as stored. */
export const Readable = Schema.TaggedStruct("Readable", { data: Schema.Json });

/** An encrypted row: its envelope as stored, and how many bytes its ciphertext has. */
export const Sealed = Schema.TaggedStruct("Sealed", { envelope: Schema.Json, bytes: Schema.Int });

/** A tombstone, with the envelope an encrypted row's delete carried. */
export const Deleted = Schema.TaggedStruct("Deleted", { envelope: Schema.NullOr(Schema.Json) });

export const Row = Schema.Struct({
  space: Ids.Id,
  /** Empty for an encrypted row, whose table only the device sees. */
  tbl: Schema.String,
  id: Ids.Id,
  version: Ids.Version,
  row: Schema.Union([Readable, Sealed, Deleted]),
  /** The command that wrote the row last, `null` for the server's own writes. */
  writtenBy: Schema.NullOr(Schema.Struct({ clientId: Ids.Id, mutationId: Ids.MutationId })),
});

export type Row = typeof Row.Type;

/** One processed command, as the command log keeps it. */
export const Processed = Schema.Struct({
  clientId: Ids.Id,
  mutationId: Ids.MutationId,
  account: Ids.Id,
  kind: Schema.Literals(["Mutate", "Seal"]),
  /** The mutator's name and version for `Mutate`. A `Seal` names no mutator. */
  name: Schema.NullOr(Ids.Name),
  version: Schema.NullOr(Schema.Int),
  applied: Schema.Boolean,
  reason: Schema.NullOr(Refusal.Reason),
  /** When the user acted, by the device's clock. */
  at: Schema.DateTimeUtc,
  processedAt: Schema.DateTimeUtc,
  /**
   * A `Mutate`'s arguments. A `Seal`'s writes with their space, id, base, envelope, ciphertext
   * size and SHA-256, and the ids of its key boxes and history links.
   */
  detail: Schema.Json,
});

export type Processed = typeof Processed.Type;

export const Response = Schema.Struct({
  spaces: Schema.Array(Space),
  rows: Schema.Array(Row),
  commands: Schema.Array(Processed),
});

export type Response = typeof Response.Type;

/** The server is no development or preview server. */
export class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("Inspect.Unavailable", {}) {}

export const Rpcs = RpcGroup.make(
  Rpc.make("Sync.inspect", { payload: Request, success: Response, error: Unavailable }),
);
