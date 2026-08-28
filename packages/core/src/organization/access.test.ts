import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import {
  AccountName,
  accountNameMaxLength,
  formatAccessCode,
  isAccessCode,
  normalizeAccessCode,
  repairAccessCode,
} from "./access.ts";

describe("account names", () => {
  it("trims names and rejects empty or overlong values", () => {
    expect(Schema.decodeSync(AccountName)("  Ada Lovelace  ")).toBe("Ada Lovelace");
    expect(Exit.isFailure(Schema.decodeExit(AccountName)("   "))).toBe(true);
    expect(
      Exit.isFailure(Schema.decodeExit(AccountName)("x".repeat(accountNameMaxLength + 1))),
    ).toBe(true);
  });
});

describe("school access codes", () => {
  it("normalizes a printed code without changing its entropy", () => {
    expect(normalizeAccessCode("01ab-cdef  ghjk-mnpq")).toBe("01ABCDEFGHJKMNPQ");
    expect(formatAccessCode("01abcdefghjkmnpq")).toBe("01AB-CDEF-GHJK-MNPQ");
  });

  it("rejects ambiguous characters and the wrong length", () => {
    expect(isAccessCode("01AB-CDEF-GHJK-MNPQ")).toBe(true);
    expect(isAccessCode("O1AB-CDEF-GHJK-MNPQ")).toBe(false);
    expect(isAccessCode("01AB-CDEF")).toBe(false);
  });

  it("reads a typed code as the code that was printed", () => {
    // The characters the alphabet drops so they never have to be told apart on paper.
    expect(repairAccessCode("OIlb-cdef-ghjk-mnpq")).toBe("011BCDEFGHJKMNPQ");
    // A stray keystroke costs itself, not everything typed after it.
    expect(repairAccessCode("01AB-CD?EF")).toBe("01ABCDEF");
    // `U` is excluded to keep codes from spelling things, so nothing should stand in for it.
    expect(repairAccessCode("U01A")).toBe("01A");
  });

  it("never lets a repaired code grow past one code", () => {
    const repaired = repairAccessCode("01AB-CDEF-GHJK-MNPQ-RSTV");
    expect(repaired).toHaveLength(16);
    expect(isAccessCode(repaired)).toBe(true);
  });
});
