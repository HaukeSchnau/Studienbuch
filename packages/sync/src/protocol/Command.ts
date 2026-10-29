/**
 * What a device pushes: one command per change, numbered per client. A readable table's command
 * carries the mutator's arguments (`Mutate`), and the server runs the mutator again. An encrypted
 * table's command carries the device's sealed result (`Seal`), and the server checks what it can
 * see. The outbox keeps every command in plaintext, and only the push seals.
 */
import { SealedRow, SpaceKey } from "@stu/e2ee";
import * as Schema from "effect/Schema";
import { Ids } from "./Ids.ts";

export * as Command from "./Command.ts";

/**
 * The largest ciphertext of one sealed row the server stores. A larger one is refused with
 * `Sync.TooLarge`, so the device checks the padded size before the command enters the outbox.
 */
export const maxSealedBytes = 65_536;

export const Mutate = Schema.TaggedStruct("Mutate", {
  mutationId: Ids.MutationId,
  name: Ids.Name,
  /** The mutator version the device ran. A version newer than the server's is answered `Retry`. */
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  /** Encoded by that version's codec. */
  args: Schema.Json,
  /** When the user acted, by the device's clock, for the command log only. */
  at: Schema.DateTimeUtc,
});

export type Mutate = typeof Mutate.Type;

/** The row as the server delivered it at `version`. */
export const AtVersion = Schema.TaggedStruct("AtVersion", { version: Ids.Version });

/** No live row: never written, or deleted. */
export const Absent = Schema.TaggedStruct("Absent", {});

/**
 * The row as this client's command `mutationId` left it, so a batch can write one row twice
 * before the server confirmed the first write.
 */
export const AfterMutation = Schema.TaggedStruct("AfterMutation", { mutationId: Ids.MutationId });

/**
 * What the device computed a sealed write from. The server answers `Stale` when the row moved
 * since, and the device pulls, replays the command on the newer row and seals it again.
 */
export const Base = Schema.Union([AtVersion, Absent, AfterMutation]);

export type Base = typeof Base.Type;

export const SealedWrite = Schema.Struct({
  space: Ids.Id,
  /** Random, such as a UUIDv4: a UUIDv7 would tell the server when the row was created. */
  id: Ids.Id,
  base: Base,
  envelope: SealedRow.Envelope,
  /** The sealed row, or `null` to delete it, which leaves a tombstone. */
  ct: Schema.NullOr(Schema.Uint8Array),
});

export type SealedWrite = typeof SealedWrite.Type;

/**
 * No mutator name: the server never runs it, and a name would tell the server and its command
 * log which rows are grades or absences, which the empty table name of a sealed row hides.
 */
export const Seal = Schema.TaggedStruct("Seal", {
  mutationId: Ids.MutationId,
  at: Schema.DateTimeUtc,
  writes: Schema.Array(SealedWrite),
  /**
   * Key boxes and history links of an epoch the command opens, such as a notebook's epoch 0 with
   * its first write. Opening an epoch the space already has is `Stale`, not a refusal.
   */
  boxes: Schema.Array(SpaceKey.KeyBox),
  links: Schema.Array(SpaceKey.HistoryLink),
});

export type Seal = typeof Seal.Type;

export const Any = Schema.Union([Mutate, Seal]);

export type Any = typeof Any.Type;
