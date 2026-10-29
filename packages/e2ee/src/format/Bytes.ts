/**
 * The pieces every byte layout is built from. Strings are UTF-8, numbers are big-endian, and every
 * field of variable length carries its length, so two different inputs never give the same bytes.
 *
 * ```text
 * label     ASCII, ending in the format version, such as "stu.row.v1"
 * u8(n)     one byte
 * u32(n)    four bytes, big-endian
 * lp(x)     u32(length of x) || x
 * text(s)   lp(UTF-8 of s); a string with an unpaired surrogate is Malformed, not U+FFFD
 * ```
 */
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { E2ee } from "./E2ee.ts";

export * as Bytes from "./Bytes.ts";

/**
 * A number that a layout writes as `u8`: format versions, suite ids and wrapper kinds. Decoding
 * accepts any byte, so an older app reads a newer value and refuses it only when it uses it.
 */
export const U8 = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xff }));

/** A number that a layout writes as `u32`: key epochs and key generations. */
export const U32 = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xffff_ffff }));

const encoder = new TextEncoder();

/** A layout's constant label. Labels are ASCII literals in this package, never input. */
export const label = (ascii: string): Uint8Array => encoder.encode(ascii);

/** Whether every surrogate in `value` is paired, which UTF-8 needs to encode it faithfully. */
export const isWellFormed = (value: string): boolean => {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);

    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);

      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return false;
    }
  }

  return true;
};

/**
 * UTF-8 of `value`. TextEncoder would turn an unpaired surrogate into U+FFFD, and two different
 * strings would then give the same bytes.
 */
export const utf8 = (
  value: string,
  format: E2ee.Format,
): Result.Result<Uint8Array, E2ee.Malformed> =>
  isWellFormed(value)
    ? Result.succeed(encoder.encode(value))
    : Result.fail(new E2ee.Malformed({ format, reason: "unpaired surrogate" }));

export const text = (
  value: string,
  format: E2ee.Format,
): Result.Result<Uint8Array, E2ee.Malformed> => Result.map(utf8(value, format), lp);

export const u8 = (value: number): Uint8Array => Uint8Array.of(value);

export const u32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);

  return bytes;
};

export const lp = (field: Uint8Array): Uint8Array => concat(u32(field.length), field);

export const concat = (...parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const bytes = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
};

/** Compares in time that depends only on the lengths, so a MAC check leaks no matching prefix. */
export const equal = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false;
  let difference = 0;

  for (let index = 0; index < a.length; index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }

  return difference === 0;
};

/** Reads layouts back, field by field. A field past the end is `undefined`. */
export class Reader {
  private readonly bytes: Uint8Array;
  private offset = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  u32(): number | undefined {
    if (this.offset + 4 > this.bytes.length) return undefined;
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset).getUint32(this.offset);
    this.offset += 4;

    return value;
  }

  take(length: number): Uint8Array | undefined {
    if (this.offset + length > this.bytes.length) return undefined;
    const field = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;

    return field;
  }

  lp(): Uint8Array | undefined {
    const length = this.u32();

    return length === undefined ? undefined : this.take(length);
  }

  rest(): Uint8Array {
    const field = this.bytes.subarray(this.offset);
    this.offset = this.bytes.length;

    return field;
  }
}
