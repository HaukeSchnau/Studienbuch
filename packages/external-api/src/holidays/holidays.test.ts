import { expect, it } from "vitest";
import { Effect } from "effect";
import { getHolidays } from "./holidays";

it("getHolidays", async () => {
  const result = await Effect.runPromise(getHolidays("NI", 2025));
  expect(result).toMatchInlineSnapshot(`
      [
        {
          "end": {
            "day": 4,
            "month": 1,
            "year": 2025,
          },
          "name": "Weihnachtsferien",
          "start": {
            "day": 23,
            "month": 12,
            "year": 2024,
          },
          "state": "NI",
          "year": 2024,
        },
        {
          "end": {
            "day": 4,
            "month": 2,
            "year": 2025,
          },
          "name": "Halbjahresferien",
          "start": {
            "day": 3,
            "month": 2,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 19,
            "month": 4,
            "year": 2025,
          },
          "name": "Osterferien",
          "start": {
            "day": 7,
            "month": 4,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 30,
            "month": 4,
            "year": 2025,
          },
          "name": "Kirchentag",
          "start": {
            "day": 30,
            "month": 4,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 2,
            "month": 5,
            "year": 2025,
          },
          "name": "Tag nach dem 1. Mai",
          "start": {
            "day": 2,
            "month": 5,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 30,
            "month": 5,
            "year": 2025,
          },
          "name": "Tag nach Himmelfahrt",
          "start": {
            "day": 30,
            "month": 5,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 10,
            "month": 6,
            "year": 2025,
          },
          "name": "Pfingstferien",
          "start": {
            "day": 10,
            "month": 6,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 13,
            "month": 8,
            "year": 2025,
          },
          "name": "Sommerferien",
          "start": {
            "day": 3,
            "month": 7,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 25,
            "month": 10,
            "year": 2025,
          },
          "name": "Herbstferien",
          "start": {
            "day": 13,
            "month": 10,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 5,
            "month": 1,
            "year": 2026,
          },
          "name": "Weihnachtsferien",
          "start": {
            "day": 22,
            "month": 12,
            "year": 2025,
          },
          "state": "NI",
          "year": 2025,
        },
        {
          "end": {
            "day": 3,
            "month": 2,
            "year": 2026,
          },
          "name": "Halbjahresferien",
          "start": {
            "day": 2,
            "month": 2,
            "year": 2026,
          },
          "state": "NI",
          "year": 2026,
        },
        {
          "end": {
            "day": 7,
            "month": 4,
            "year": 2026,
          },
          "name": "Osterferien",
          "start": {
            "day": 23,
            "month": 3,
            "year": 2026,
          },
          "state": "NI",
          "year": 2026,
        },
        {
          "end": {
            "day": 15,
            "month": 5,
            "year": 2026,
          },
          "name": "Tag nach Himmelfahrt",
          "start": {
            "day": 15,
            "month": 5,
            "year": 2026,
          },
          "state": "NI",
          "year": 2026,
        },
        {
          "end": {
            "day": 26,
            "month": 5,
            "year": 2026,
          },
          "name": "Pfingstferien",
          "start": {
            "day": 26,
            "month": 5,
            "year": 2026,
          },
          "state": "NI",
          "year": 2026,
        },
        {
          "end": {
            "day": 12,
            "month": 8,
            "year": 2026,
          },
          "name": "Sommerferien",
          "start": {
            "day": 2,
            "month": 7,
            "year": 2026,
          },
          "state": "NI",
          "year": 2026,
        },
        {
          "end": {
            "day": 24,
            "month": 10,
            "year": 2026,
          },
          "name": "Herbstferien",
          "start": {
            "day": 12,
            "month": 10,
            "year": 2026,
          },
          "state": "NI",
          "year": 2026,
        },
        {
          "end": {
            "day": 9,
            "month": 1,
            "year": 2027,
          },
          "name": "Weihnachtsferien",
          "start": {
            "day": 23,
            "month": 12,
            "year": 2026,
          },
          "state": "NI",
          "year": 2026,
        },
        {
          "end": {
            "day": 2,
            "month": 2,
            "year": 2027,
          },
          "name": "Halbjahresferien",
          "start": {
            "day": 1,
            "month": 2,
            "year": 2027,
          },
          "state": "NI",
          "year": 2027,
        },
        {
          "end": {
            "day": 3,
            "month": 4,
            "year": 2027,
          },
          "name": "Osterferien",
          "start": {
            "day": 22,
            "month": 3,
            "year": 2027,
          },
          "state": "NI",
          "year": 2027,
        },
        {
          "end": {
            "day": 7,
            "month": 5,
            "year": 2027,
          },
          "name": "Tag nach Himmelfahrt",
          "start": {
            "day": 7,
            "month": 5,
            "year": 2027,
          },
          "state": "NI",
          "year": 2027,
        },
        {
          "end": {
            "day": 18,
            "month": 5,
            "year": 2027,
          },
          "name": "Pfingstferien",
          "start": {
            "day": 18,
            "month": 5,
            "year": 2027,
          },
          "state": "NI",
          "year": 2027,
        },
        {
          "end": {
            "day": 18,
            "month": 8,
            "year": 2027,
          },
          "name": "Sommerferien",
          "start": {
            "day": 8,
            "month": 7,
            "year": 2027,
          },
          "state": "NI",
          "year": 2027,
        },
        {
          "end": {
            "day": 30,
            "month": 10,
            "year": 2027,
          },
          "name": "Herbstferien",
          "start": {
            "day": 16,
            "month": 10,
            "year": 2027,
          },
          "state": "NI",
          "year": 2027,
        },
      ]
    `);
});
