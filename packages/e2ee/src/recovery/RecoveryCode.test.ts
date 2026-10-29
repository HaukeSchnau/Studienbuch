import { assert, describe, it } from "@effect/vitest";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";

import { RecoveryCode } from "./RecoveryCode.ts";

// 0x08 in every byte gives a text full of 0 and 1, the characters that have lookalikes.
const bytes = Redacted.make(new Uint8Array(16).fill(0x08));
const text = Redacted.value(RecoveryCode.text(bytes));

const reason = (input: string) =>
  Result.match(RecoveryCode.parse(input), {
    onFailure: (error) => error.reason,
    onSuccess: () => "parsed",
  });

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * 8 codes from a fixed linear congruential generator; the property needs no secure randomness.
 * The CRC is linear, so a miss depends on the error alone, and each code tries every substitution.
 */
const codes = (() => {
  let state = 12_345;

  return Array.from({ length: 8 }, () =>
    Uint8Array.from({ length: 16 }, () => {
      state = (state * 1_103_515_245 + 12_345) >>> 0;

      return state >>> 24;
    }),
  );
})();

describe("parse", () => {
  it("accepts what people type: lower case, spaces, no dashes, O, I and L", () => {
    const typed = [
      text,
      text.toLowerCase(),
      text.replaceAll("-", " "),
      text.replaceAll("-", ""),
      text.replaceAll("0", "O").replaceAll("1", "I"),
      text.replaceAll("1", "l"),
      `  ${Redacted.value(RecoveryCode.qr(RecoveryCode.text(bytes)))}\n`,
    ];

    assert.isTrue(text.includes("0") && text.includes("1"));

    assert.isTrue(
      typed.every((input) =>
        Result.match(RecoveryCode.parse(input), {
          onFailure: () => false,
          onSuccess: (parsed) => Redacted.value(parsed).every((byte) => byte === 0x08),
        }),
      ),
    );
  });

  it("refuses 27 and 29 characters, and characters outside the alphabet", () => {
    const plain = text.replaceAll("-", "");

    assert.deepStrictEqual(
      [reason(plain.slice(1)), reason(`${plain}0`), reason(`U${plain.slice(1)}`)],
      ["length", "length", "character"],
    );
  });

  // A CRC of degree 12 detects every burst of up to 12 bits: a substituted character changes 5
  // bits, two swapped neighbours at most 10.
  it("catches every single substitution and every swap of two different neighbours", () => {
    const missed: Array<string> = [];

    for (const code of codes) {
      const characters = Redacted.value(RecoveryCode.text(Redacted.make(code)))
        .replaceAll("-", "")
        .split("");

      for (const [index, original] of characters.entries()) {
        for (const replacement of alphabet) {
          if (replacement === original) continue;
          const changed = characters.with(index, replacement).join("");

          if (reason(changed) !== "check") missed.push(changed);
        }

        const next = characters[index + 1];

        if (next !== undefined && next !== original) {
          const swapped = characters
            .with(index, next)
            .with(index + 1, original)
            .join("");

          if (reason(swapped) !== "check") missed.push(swapped);
        }
      }
    }

    assert.deepStrictEqual(missed, []);
  });
});
