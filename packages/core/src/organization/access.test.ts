import { describe, expect, it } from "vite-plus/test";
import { formatAccessCode, isAccessCode, normalizeAccessCode } from "./access.ts";

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
});
