import { fromPartial } from "@total-typescript/shoehorn";
import { expect, test } from "vitest";

import { formalName } from "./teacher";

test("formalName", () => {
  expect(formalName(fromPartial({ name: "Bernd" }))).toBe("Bernd");
  expect(formalName(fromPartial({ name: "Müller" }))).toBe("Müller");
  expect(formalName(fromPartial({ name: "Bernd Müller" }))).toBe(
    "Bernd Müller",
  );
  expect(
    formalName(fromPartial({ name: "Bernd Müller", salutation: "Herr" })),
  ).toBe("Herr Müller");
});
