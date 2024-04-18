import { describe, expect, it } from "vitest";

import { loginIservWithDefaultCredentials } from "./auth";
import { findAbbrvName } from "./findAbbrvName";

describe("IServ", () => {
  it("should authenticate", async () => {
    await loginIservWithDefaultCredentials();
  });

  it("should find name for valid abbreviation", async () => {
    const makeRequest = await loginIservWithDefaultCredentials();
    const result = await findAbbrvName(makeRequest, "WAL");
    expect(result).toEqual({
      name: "Leif Walczak",
      email: "leif.walczak@igslilienthal.de",
    });
  });

  it("should not find name for invalid abbreviation", async () => {
    const makeRequest = await loginIservWithDefaultCredentials();
    const result = await findAbbrvName(makeRequest, "INVALID");
    expect(result).toBeNull();
  });
});
