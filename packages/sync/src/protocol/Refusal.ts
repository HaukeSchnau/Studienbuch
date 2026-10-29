/**
 * Why the server refused a command. It still counts as processed, its effect leaves the device,
 * and the device that sent it shows "Nicht übernommen" with one sentence per tag. A reason is the
 * mutator's own error, a `Tx.*` error from running it again, or one of the engine's below.
 */
import * as Schema from "effect/Schema";
import { Ids } from "./Ids.ts";

export * as Refusal from "./Refusal.ts";

/**
 * The author isn't the connection's account, or not a member of the space, as when a modified app
 * writes into another student's notebook.
 */
export class NotMember extends Schema.TaggedError<NotMember, { readonly brand: unique symbol }>()(
  "Sync.NotMember",
  { space: Ids.Id },
) {}

/** The author's role in the space may not write there. */
export class NotAllowed extends Schema.TaggedError<NotAllowed, { readonly brand: unique symbol }>()(
  "Sync.NotAllowed",
  { space: Ids.Id },
) {}

/** A confirmation froze the row. */
export class Locked extends Schema.TaggedError<Locked, { readonly brand: unique symbol }>()(
  "Sync.Locked",
  { space: Ids.Id, id: Ids.Id },
) {}

/** A sealed write's envelope names a format or suite the server doesn't know, or its signature fails. */
export class BadEnvelope extends Schema.TaggedError<
  BadEnvelope,
  { readonly brand: unique symbol }
>()("Sync.BadEnvelope", { space: Ids.Id, id: Ids.Id }) {}

/** A sealed row's ciphertext is larger than `Command.maxSealedBytes`. */
export class TooLarge extends Schema.TaggedError<TooLarge, { readonly brand: unique symbol }>()(
  "Sync.TooLarge",
  { space: Ids.Id, id: Ids.Id },
) {}

/** No mutator of that name exists on the server, or it was retired. */
export class UnknownMutator extends Schema.TaggedError<
  UnknownMutator,
  { readonly brand: unique symbol }
>()("Sync.UnknownMutator", { mutator: Ids.Name }) {}

/** The arguments don't decode with the mutator's codec for that version. */
export class InvalidArgs extends Schema.TaggedError<
  InvalidArgs,
  { readonly brand: unique symbol }
>()("Sync.InvalidArgs", { mutator: Ids.Name, version: Schema.Int }) {}

export const Engine = Schema.Union([
  NotMember,
  NotAllowed,
  Locked,
  BadEnvelope,
  TooLarge,
  UnknownMutator,
  InvalidArgs,
]);

export type Engine = typeof Engine.Type;

/**
 * Any refusal as it travels: its tag and its encoded fields. A device decodes the tags it knows
 * and shows a general sentence for a tag from a newer server.
 */
export const Reason = Schema.StructWithRest(Schema.Struct({ _tag: Schema.String }), [
  Schema.Record(Schema.String, Schema.Json),
]);

export type Reason = typeof Reason.Type;
