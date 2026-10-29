/**
 * The pieces every byte layout is built from. Strings are UTF-8, numbers are big-endian, and every
 * field of variable length carries its length, so two different inputs never give the same bytes.
 *
 * ```text
 * label     ASCII, ending in the format version, such as "stu.row.v1"
 * u8(n)     one byte
 * u32(n)    four bytes, big-endian
 * lp(x)     u32(length of x) || x
 * text(s)   lp(UTF-8 of s)
 * ```
 */
import * as Schema from "effect/Schema";

export * as Bytes from "./Bytes.ts";

/**
 * A number that a layout writes as `u8`: format versions and suite ids. Decoding accepts any byte,
 * so an older app reads a newer version and refuses it only when it opens the row.
 */
export const U8 = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xff }));

/** A number that a layout writes as `u32`: key epochs and key generations. */
export const U32 = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xffff_ffff }));

const encoder = new TextEncoder();

export const utf8 = (text: string): Uint8Array => encoder.encode(text);

export const u8 = (value: number): Uint8Array => Uint8Array.of(value);

export const u32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);

  return bytes;
};

export const lp = (field: Uint8Array): Uint8Array => concat(u32(field.length), field);

export const text = (value: string): Uint8Array => lp(utf8(value));

export const concat = (...parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const bytes = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
};
