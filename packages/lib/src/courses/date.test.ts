import { expect, test } from "vitest";

import { isNormalTime, parseTime } from "./date";

test("parseTime", () => {
  expect(parseTime("08:00")).toBe(8 * 60);
  expect(parseTime("08:01")).toBe(8 * 60 + 1);
  expect(parseTime("00:00")).toBe(0);
  expect(parseTime("00:01")).toBe(1);
  expect(parseTime("23:59")).toBe(23 * 60 + 59);

  expect(() => parseTime("")).toThrowError();
  expect(() => parseTime("08")).toThrowError();
  expect(() => parseTime("08:")).toThrowError();
  expect(() => parseTime(":00")).toThrowError();
  expect(() => parseTime(":")).toThrowError();
  expect(() => parseTime("ab:cd")).toThrowError();
});

test("isNormalTime", () => {
  expect(isNormalTime(8 * 60)).toBe(true);
  expect(isNormalTime(8 * 60 + 1)).toBe(false);
});
