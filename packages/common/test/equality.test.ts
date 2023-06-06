import { expect, test } from "vitest";

import { compareMaps } from "../src/equality";

test("compareMaps", () => {
  expect(compareMaps(new Map(), new Map())).toBe(true);
  expect(compareMaps(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(true);
  expect(compareMaps(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false);
  expect(compareMaps(new Map([["a", 1]]), new Map([["b", 1]]))).toBe(false);
  expect(compareMaps(new Map([["a", 1]]), new Map([["b", 2]]))).toBe(false);
  expect(
    compareMaps(
      new Map([["a", 1]]),
      new Map([
        ["b", 2],
        ["a", 1],
      ]),
    ),
  ).toBe(false);
  expect(
    compareMaps(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
      new Map([
        ["b", 2],
        ["a", 1],
      ]),
    ),
  ).toBe(true);
});


