/**
 * Identifiers and counters on the wire. Ids are text that the caller generates, UUIDs in
 * practice, compared in UTF-8 byte order. Counters stay far below 2^53.
 */
import * as Schema from "effect/Schema";

export * as Ids from "./Ids.ts";

/** A space's, row's or client's id. Bounded, because the server stores every id it accepts. */
export const Id = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64));

/** A mutator's, table's, space kind's or role's name. */
export const Name = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64));

/** Numbers a client's commands from 1, without gaps. */
export const MutationId = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));

/** The last mutation id a server applied or a device settled, 0 before the first. */
export const LastMutationId = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * A space's counter, bumped by every commit that writes the space, and stamped on the rows that
 * commit wrote. 0 for a space nobody wrote yet.
 */
export const Version = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** The restore epoch, which changes whenever the server's database comes back from a backup. */
export const SyncEpoch = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128));
