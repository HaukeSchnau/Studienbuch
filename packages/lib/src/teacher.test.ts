import { expect, test } from "vitest";

import { Teacher } from "./teacher";

test("formalName", () => {
  expect(Teacher.formalName({ firstName: "Bernd", lastName: "Müller", salutation: null })).toBe("Bernd Müller");
  expect(Teacher.formalName({ firstName: "Bernd", lastName: "Müller", salutation: "Herr" })).toBe("Herr Müller");
});
