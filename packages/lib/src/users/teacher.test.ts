import { expect, test } from "vitest";

import { formalName } from "./teacher";

test("formalName", () => {
  expect(formalName({ name: "Bernd", salutation: null })).toBe("Bernd");
  expect(formalName({ name: "Müller", salutation: null })).toBe("Müller");
  expect(formalName({ name: "Bernd Müller", salutation: null })).toBe(
    "Bernd Müller",
  );
  expect(formalName({ name: "Bernd Müller", salutation: "Herr" })).toBe(
    "Herr Müller",
  );
});
