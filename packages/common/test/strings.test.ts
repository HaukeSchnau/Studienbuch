import { expect, test } from "vitest";

import { capitalize } from "../src/infrastructure/strings";

test("capitalize", () => {
  expect(capitalize("hello")).toBe("Hello");
  expect(capitalize("hello world")).toBe("Hello world");
  expect(capitalize("")).toBe("");
  expect(capitalize(null)).toBe("");
  expect(capitalize(undefined)).toBe("");
});
