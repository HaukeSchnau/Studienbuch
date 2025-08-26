import { describe, expect, test } from "vitest";

import {
  dateToSimpleDate,
  formatSimpleDate,
  formatSimpleTimeOfDay,
  parseSimpleDate,
  parseSimpleTimeOfDay,
  type SimpleDate,
  simpleDateSchema,
  simpleDateToDate,
} from "./dates";

describe("parseSimpleDate", () => {
  test("parses valid date strings", () => {
    expect(parseSimpleDate("2023-01-15")).toEqual({
      year: 2023,
      month: 1,
      day: 15,
    });
    expect(parseSimpleDate("2024-12-31")).toEqual({
      year: 2024,
      month: 12,
      day: 31,
    });
    expect(parseSimpleDate("2000-06-01")).toEqual({
      year: 2000,
      month: 6,
      day: 1,
    });
  });

  test("throws error for invalid date format", () => {
    expect(() => parseSimpleDate("invalid")).toThrow("Invalid date: invalid");
    expect(() => parseSimpleDate("2023-01")).toThrow("Invalid date: 2023-01");
  });

  test("throws error for non-numeric values", () => {
    expect(() => parseSimpleDate("2023-abc-15")).toThrow("Invalid date: 2023-abc-15");
    expect(() => parseSimpleDate("abc-01-15")).toThrow("Invalid date: abc-01-15");
    expect(() => parseSimpleDate("2023-01-abc")).toThrow("Invalid date: 2023-01-abc");
  });
});

describe("formatSimpleDate", () => {
  test("formats dates correctly", () => {
    expect(formatSimpleDate({ year: 2023, month: 1, day: 15 })).toBe("2023-01-15");
    expect(formatSimpleDate({ year: 2024, month: 12, day: 31 })).toBe("2024-12-31");
    expect(formatSimpleDate({ year: 2000, month: 6, day: 1 })).toBe("2000-06-01");
  });

  test("pads single digits with zeros", () => {
    expect(formatSimpleDate({ year: 2023, month: 1, day: 5 })).toBe("2023-01-05");
    expect(formatSimpleDate({ year: 2023, month: 5, day: 1 })).toBe("2023-05-01");
  });

  test("handles edge cases", () => {
    expect(formatSimpleDate({ year: 2000, month: 1, day: 1 })).toBe("2000-01-01");
    expect(formatSimpleDate({ year: 2100, month: 12, day: 31 })).toBe("2100-12-31");
  });
});

describe("parseSimpleTimeOfDay", () => {
  test("parses valid time strings", () => {
    expect(parseSimpleTimeOfDay("00:00")).toBe(0);
    expect(parseSimpleTimeOfDay("12:00")).toBe(720);
    expect(parseSimpleTimeOfDay("23:59")).toBe(1439);
    expect(parseSimpleTimeOfDay("09:30")).toBe(570);
    expect(parseSimpleTimeOfDay("14:45")).toBe(885);
  });

  test("throws error for invalid time format", () => {
    expect(() => parseSimpleTimeOfDay("invalid")).toThrow("Invalid time: invalid");
    expect(() => parseSimpleTimeOfDay("12")).toThrow("Invalid time: 12");
  });

  test("throws error for non-numeric values", () => {
    expect(() => parseSimpleTimeOfDay("ab:30")).toThrow("Invalid time: ab:30");
    expect(() => parseSimpleTimeOfDay("12:cd")).toThrow("Invalid time: 12:cd");
  });
});

describe("simpleDateToDate", () => {
  test("converts SimpleDate to Date correctly", () => {
    const simpleDate: SimpleDate = { year: 2023, month: 6, day: 15 };
    const date = simpleDateToDate(simpleDate);

    expect(date.getFullYear()).toBe(2023);
    expect(date.getMonth()).toBe(5); // June is month 5 (0-indexed)
    expect(date.getDate()).toBe(15);
  });

  test("handles different months correctly", () => {
    const janDate = simpleDateToDate({ year: 2023, month: 1, day: 1 });
    expect(janDate.getMonth()).toBe(0); // January is month 0

    const decDate = simpleDateToDate({ year: 2023, month: 12, day: 31 });
    expect(decDate.getMonth()).toBe(11); // December is month 11
  });

  test("creates date at midnight", () => {
    const simpleDate: SimpleDate = { year: 2023, month: 6, day: 15 };
    const date = simpleDateToDate(simpleDate);

    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
    expect(date.getMilliseconds()).toBe(0);
  });
});

describe("dateToSimpleDate", () => {
  test("converts Date to SimpleDate correctly", () => {
    const date = new Date(2023, 5, 15); // June 15, 2023
    const simpleDate = dateToSimpleDate(date);

    expect(simpleDate).toEqual({
      year: 2023,
      month: 6,
      day: 15,
    });
  });

  test("handles timezone offset correctly", () => {
    // Create a date that would be affected by timezone
    const date = new Date(2023, 11, 31, 23, 59, 59); // December 31, 2023 23:59:59
    const simpleDate = dateToSimpleDate(date);

    // The result should be in UTC, not local time
    expect(simpleDate.year).toBe(2024);
    expect(simpleDate.month).toBe(1);
    expect(simpleDate.day).toBe(1);
  });

  test("handles edge cases", () => {
    const janFirst = new Date(2023, 0, 1);
    expect(dateToSimpleDate(janFirst)).toEqual({
      year: 2023,
      month: 1,
      day: 1,
    });

    const decLast = new Date(2023, 11, 31);
    expect(dateToSimpleDate(decLast)).toEqual({
      year: 2023,
      month: 12,
      day: 31,
    });
  });
});

describe("simpleDateSchema", () => {
  test("validates correct SimpleDate objects", () => {
    const validDate = { year: 2023, month: 6, day: 15 };
    expect(() => simpleDateSchema.parse(validDate)).not.toThrow();
  });

  test("rejects invalid years", () => {
    expect(() => simpleDateSchema.parse({ year: 1999, month: 6, day: 15 })).toThrow();
    expect(() => simpleDateSchema.parse({ year: 2101, month: 6, day: 15 })).toThrow();
  });

  test("rejects invalid months", () => {
    expect(() => simpleDateSchema.parse({ year: 2023, month: 0, day: 15 })).toThrow();
    expect(() => simpleDateSchema.parse({ year: 2023, month: 13, day: 15 })).toThrow();
  });

  test("rejects invalid days", () => {
    expect(() => simpleDateSchema.parse({ year: 2023, month: 6, day: 0 })).toThrow();
    expect(() => simpleDateSchema.parse({ year: 2023, month: 6, day: 32 })).toThrow();
  });

  test("rejects non-integer values", () => {
    expect(() => simpleDateSchema.parse({ year: 2023.5, month: 6, day: 15 })).toThrow();
    expect(() => simpleDateSchema.parse({ year: 2023, month: 6.5, day: 15 })).toThrow();
    expect(() => simpleDateSchema.parse({ year: 2023, month: 6, day: 15.5 })).toThrow();
  });
});

describe("round-trip conversions", () => {
  test("parseSimpleDate and formatSimpleDate are inverse operations", () => {
    const dateStr = "2023-06-15";
    const simpleDate = parseSimpleDate(dateStr);
    const formatted = formatSimpleDate(simpleDate);
    expect(formatted).toBe(dateStr);
  });

  test("simpleDateToDate and dateToSimpleDate are inverse operations", () => {
    const originalDate = new Date(2023, 5, 15, 12, 30, 45, 123);
    const simpleDate = dateToSimpleDate(originalDate);
    const convertedDate = simpleDateToDate(simpleDate);

    // The dates should be the same day (ignoring time)
    expect(convertedDate.getFullYear()).toBe(originalDate.getFullYear());
    expect(convertedDate.getMonth()).toBe(originalDate.getMonth());
    expect(convertedDate.getDate()).toBe(originalDate.getDate());
  });
});

test("formatSimpleTimeOfDay", () => {
  expect(formatSimpleTimeOfDay(8 * 60)).toBe("08:00");
  expect(formatSimpleTimeOfDay(8 * 60 + 1)).toBe("08:01");
  expect(formatSimpleTimeOfDay(0)).toBe("00:00");
  expect(formatSimpleTimeOfDay(1)).toBe("00:01");
  expect(formatSimpleTimeOfDay(23 * 60 + 59)).toBe("23:59");
});
