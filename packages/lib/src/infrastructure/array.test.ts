import { describe, expect, test } from "vitest";

import { isArrayNonEmpty, isArraySingleElement } from "./array";

describe("isArraySingleElement", () => {
  test("returns true for array with single non-null element", () => {
    expect(isArraySingleElement([1])).toBe(true);
    expect(isArraySingleElement(["hello"])).toBe(true);
    expect(isArraySingleElement([{ id: 1 }])).toBe(true);
  });

  test("returns false for empty array", () => {
    expect(isArraySingleElement([])).toBe(false);
  });

  test("returns false for array with multiple elements", () => {
    expect(isArraySingleElement([1, 2])).toBe(false);
    expect(isArraySingleElement([1, 2, 3])).toBe(false);
  });

  test("returns false for array with single null element", () => {
    expect(isArraySingleElement([null])).toBe(false);
  });

  test("returns false for array with single undefined element", () => {
    expect(isArraySingleElement([undefined])).toBe(false);
  });

  test("returns false for array with single nullish element in mixed array", () => {
    expect(isArraySingleElement([null, 1])).toBe(false);
    expect(isArraySingleElement([undefined, "test"])).toBe(false);
  });

  test("type guard works correctly", () => {
    const arr: (number | null)[] = [1];
    if (isArraySingleElement(arr)) {
      // TypeScript should know arr is [NonNullable<number | null>] which is [number]
      expect(arr[0]).toBe(1);
      expect(typeof arr[0]).toBe("number");
    }
  });
});

describe("isArrayNonEmpty", () => {
  test("returns true for array with elements", () => {
    expect(isArrayNonEmpty([1])).toBe(true);
    expect(isArrayNonEmpty([1, 2, 3])).toBe(true);
    expect(isArrayNonEmpty(["hello", "world"])).toBe(true);
    expect(isArrayNonEmpty([null, undefined])).toBe(true);
  });

  test("returns false for empty array", () => {
    expect(isArrayNonEmpty([])).toBe(false);
  });

  test("type guard works correctly", () => {
    const arr: number[] = [1, 2, 3];
    if (isArrayNonEmpty(arr)) {
      // TypeScript should know arr is NonEmptyArray<number>
      expect(arr.at(-1)).toBe(3);
      expect(arr.length).toBeGreaterThan(0);
    }
  });

  test("works with different types", () => {
    expect(isArrayNonEmpty([true, false])).toBe(true);
    expect(isArrayNonEmpty([{ id: 1 }, { id: 2 }])).toBe(true);
    expect(isArrayNonEmpty([[], [1, 2]])).toBe(true);
  });
});
