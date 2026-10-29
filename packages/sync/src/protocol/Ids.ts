/**
 * Identifiers and counters on the wire. Ids are text that the caller generates, UUIDs in
 * practice, compared in UTF-8 byte order. Counters stay far below 2^53.
 */
import { CryptoSuite } from "@stu/e2ee";
import * as Effect from "effect/Effect";
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

/**
 * A new random id, a UUIDv4 from the suite's secure generator. Encrypted rows and client ids take
 * one: a UUIDv7 would tell the server when a row was made, and two devices must never draw the
 * same client id. The suite's test layer makes it reproducible from a seed.
 */
export const random: Effect.Effect<string, never, CryptoSuite.Service> = Effect.map(
  CryptoSuite.Service.use((suite) => suite.randomBytes(16)),
  (bytes) => {
    const hex = [...bytes].map((byte, index) => {
      // RFC 9562: version 4 in the high nibble of byte 6, variant 0b10 in the high bits of byte 8.
      const value = index === 6 ? (byte & 0x0f) | 0x40 : index === 8 ? (byte & 0x3f) | 0x80 : byte;

      return value.toString(16).padStart(2, "0");
    });

    return [hex.slice(0, 4), hex.slice(4, 6), hex.slice(6, 8), hex.slice(8, 10), hex.slice(10, 16)]
      .map((group) => group.join(""))
      .join("-");
  },
);
