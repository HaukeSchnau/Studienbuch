/**
 * The Notfallkarte's code: 128 random bits and a CRC-12, as 28 Crockford base32 characters in seven
 * groups of four. The CRC catches every mistyped character and every swap of two neighbours on the
 * device, so a typo and a wrong card get different messages. The QR code holds text, not a URL.
 *
 * ```text
 * check  = CRC-12 of bytes(16): polynomial 0x80F, initial 0, no reflection, no final XOR
 *          (CRC-12/DECT; "123456789" gives 0xF5B)
 * text   = base32(bytes || check), 140 bits, groups of 4 joined by "-": ZGWY-6WXJ-9MB6-...
 * QR     = "STUDIENBUCH-NOTFALLKARTE-1:" || text
 * parse  ignores case, spaces and dashes, and reads O as 0 and I or L as 1
 * ```
 */
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { CryptoSuite } from "../suite/CryptoSuite.ts";

export * as RecoveryCode from "./RecoveryCode.ts";

export class Invalid extends Schema.TaggedError<Invalid, { readonly brand: unique symbol }>()(
  "RecoveryCode.Invalid",
  {
    reason: Schema.Literals([
      // Not 28 characters once spaces and dashes are gone.
      "length",
      // A character outside the alphabet, such as U.
      "character",
      // Every character is valid, but the check doesn't match: a typo.
      "check",
    ]),
  },
) {}

/** Crockford's base32, the alphabet of access codes too. */
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const lookalikes = new Map([
  ["O", "0"],
  ["I", "1"],
  ["L", "1"],
]);

export const qrPrefix = "STUDIENBUCH-NOTFALLKARTE-1:";

const codeLength = 16;
const textLength = 28;

// A codeword of a degree-12 CRC differs from every other in more than a 12-bit burst, and a
// substituted character is a 5-bit burst, two swapped neighbours a 10-bit one.
const check = (bytes: Uint8Array) => {
  let crc = 0;

  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit--) {
      const feedback = ((crc >> 11) & 1) ^ ((byte >> bit) & 1);
      crc = (crc << 1) & 0xfff;

      if (feedback === 1) crc ^= 0x80f;
    }
  }

  return crc;
};

/** The 28 characters of a code's 16 bytes, in groups of four. The text is as secret as the bytes. */
export const text = (code: Redacted.Redacted<Uint8Array>): Redacted.Redacted => {
  const bytes = Redacted.value(code);

  // The 140 bits are the 128 of the code and the 12 of the check, read five at a time.
  const fields: ReadonlyArray<readonly [value: number, width: number]> = [
    ...[...bytes].map((byte) => [byte, 8] as const),
    [check(bytes), 12],
  ];

  let pending = 0;
  let pendingBits = 0;
  let characters = "";

  for (const [value, width] of fields) {
    pending = (pending << width) | value;
    pendingBits += width;

    while (pendingBits >= 5) {
      pendingBits -= 5;
      characters += alphabet[(pending >> pendingBits) & 0x1f];
    }

    pending &= (1 << pendingBits) - 1;
  }

  return Redacted.make(characters.match(/.{4}/gu)?.join("-") ?? characters);
};

/** A new random code, as its bytes and its text. */
export const generate = Effect.gen(function* () {
  const bytes = Redacted.make(yield* (yield* CryptoSuite.Service).randomBytes(codeLength));

  return { bytes, text: text(bytes) };
});

/** What the QR code on the card holds. */
export const qr = (codeText: Redacted.Redacted): Redacted.Redacted =>
  Redacted.make(qrPrefix + Redacted.value(codeText));

/** The code's 16 bytes from what the student typed or scanned. */
export const parse = (input: string): Result.Result<Redacted.Redacted<Uint8Array>, Invalid> => {
  const trimmed = input.trim();

  const withoutPrefix = trimmed.toUpperCase().startsWith(qrPrefix)
    ? trimmed.slice(qrPrefix.length)
    : trimmed;

  const normalized = withoutPrefix
    .toUpperCase()
    .replace(/[\s-]/gu, "")
    .split("")
    .map((character) => lookalikes.get(character) ?? character)
    .join("");

  if (normalized.length !== textLength) return Result.fail(new Invalid({ reason: "length" }));
  const values = normalized.split("").map((character) => alphabet.indexOf(character));

  if (values.includes(-1)) return Result.fail(new Invalid({ reason: "character" }));
  const bytes = new Uint8Array(codeLength);
  let pending = 0;
  let pendingBits = 0;
  let written = 0;

  for (const value of values) {
    pending = (pending << 5) | value;
    pendingBits += 5;

    if (pendingBits >= 8 && written < codeLength) {
      pendingBits -= 8;
      bytes[written] = (pending >> pendingBits) & 0xff;
      written += 1;
      pending &= (1 << pendingBits) - 1;
    }
  }

  // What remains are the 12 bits of the check.
  return pending === check(bytes)
    ? Result.succeed(Redacted.make(bytes))
    : Result.fail(new Invalid({ reason: "check" }));
};
