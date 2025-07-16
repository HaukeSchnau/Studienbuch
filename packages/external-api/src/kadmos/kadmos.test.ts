import { describe, expect, it } from "vitest";

import { getSubstitutionsFromKadmos } from "./subs";

describe("Kadmos", () => {
  it("should fetch substitutions", async () => {
    await getSubstitutionsFromKadmos("IGS Lilienthal", "iServ_SuS_heute", new Date());
  });

  it("should fetch substitutions for tomorrow", async () => {
    await getSubstitutionsFromKadmos("IGS Lilienthal", "iServ_SuS_morgen", new Date());
  });

  it("should error on invalid school", async () => {
    await expect(getSubstitutionsFromKadmos("INVALID", "iServ_SuS_heute", new Date())).rejects.toThrowError();
  });

  it("should error on invalid type", async () => {
    await expect(getSubstitutionsFromKadmos("IGS Lilienthal", "INVALID", new Date())).rejects.toThrowError();
  });
});
