import { expect, test } from "vitest";

import { formalName } from "./teacher";

test("formalName", () => {
  expect(
    formalName({ firstName: "Bernd", lastName: "Müller", salutation: null }),
  ).toBe("Bernd Müller");
  expect(
    formalName({ firstName: "Bernd", lastName: "Müller", salutation: "Herr" }),
  ).toBe("Herr Müller");
});
