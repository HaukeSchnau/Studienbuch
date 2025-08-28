import { describe, expect, test } from "vitest";

import { BetterMap, compareMaps } from "./map";

describe("compareMaps", () => {
  test("returns true for empty maps", () => {
    expect(compareMaps(new Map(), new Map())).toBe(true);
  });

  test("returns true for maps with same key-value pairs", () => {
    expect(compareMaps(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(true);
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

  test("returns false for maps with different values", () => {
    expect(compareMaps(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(false);
  });

  test("returns false for maps with different keys", () => {
    expect(compareMaps(new Map([["a", 1]]), new Map([["b", 1]]))).toBe(false);
  });

  test("returns false for maps with different key-value pairs", () => {
    expect(compareMaps(new Map([["a", 1]]), new Map([["b", 2]]))).toBe(false);
  });

  test("returns false for maps with different sizes", () => {
    expect(
      compareMaps(
        new Map([["a", 1]]),
        new Map([
          ["b", 2],
          ["a", 1],
        ]),
      ),
    ).toBe(false);
  });

  test("handles undefined values correctly", () => {
    expect(compareMaps(new Map([["b", 2]]), new Map([["b", undefined]]))).toBe(false);
    expect(compareMaps(new Map([["b", undefined]]), new Map([["b", undefined]]))).toBe(true);
  });

  test("handles complex values", () => {
    const obj1 = { id: 1, name: "test" };
    const obj2 = { id: 1, name: "test" };
    const obj3 = { id: 2, name: "test" };

    expect(compareMaps(new Map([["key", obj1]]), new Map([["key", obj2]]))).toBe(false); // Different object references
    expect(compareMaps(new Map([["key", obj1]]), new Map([["key", obj3]]))).toBe(false);
  });
});

describe("BetterMap", () => {
  describe("static uniqueFromValues", () => {
    test("creates map from array of objects with specified key", () => {
      const values = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 3, name: "Charlie" },
      ];

      const map = BetterMap.uniqueFromValues(values, "id");

      expect(map.size).toBe(3);
      expect(map.get(1)).toEqual({ id: 1, name: "Alice" });
      expect(map.get(2)).toEqual({ id: 2, name: "Bob" });
      expect(map.get(3)).toEqual({ id: 3, name: "Charlie" });
    });

    test("overwrites duplicate keys with last value", () => {
      const values = [
        { id: 1, name: "Alice" },
        { id: 1, name: "Alice Updated" },
        { id: 2, name: "Bob" },
      ];

      const map = BetterMap.uniqueFromValues(values, "id");

      expect(map.size).toBe(2);
      expect(map.get(1)).toEqual({ id: 1, name: "Alice Updated" });
      expect(map.get(2)).toEqual({ id: 2, name: "Bob" });
    });

    test("works with different key types", () => {
      const values = [
        { key: "a", value: 1 },
        { key: "b", value: 2 },
        { key: "c", value: 3 },
      ];

      const map = BetterMap.uniqueFromValues(values, "key");

      expect(map.size).toBe(3);
      expect(map.get("a")).toEqual({ key: "a", value: 1 });
      expect(map.get("b")).toEqual({ key: "b", value: 2 });
      expect(map.get("c")).toEqual({ key: "c", value: 3 });
    });

    test("handles empty array", () => {
      const map = BetterMap.uniqueFromValues([], "id");
      expect(map.size).toBe(0);
    });
  });

  describe("getWithDefault", () => {
    test("returns existing value when key exists", () => {
      const map = new BetterMap<string, number>();
      map.set("a", 1);

      expect(map.getWithDefault("a", 42)).toBe(1);
    });

    test("sets and returns default value when key doesn't exist", () => {
      const map = new BetterMap<string, number>();

      expect(map.getWithDefault("a", 42)).toBe(42);
      expect(map.has("a")).toBe(true);
      expect(map.get("a")).toBe(42);
    });

    test("works with different types", () => {
      const map = new BetterMap<string, string>();
      const defaultStr = "default";

      expect(map.getWithDefault("key", defaultStr)).toBe(defaultStr);
      expect(map.get("key")).toBe(defaultStr);
    });

    test("works with objects", () => {
      const map = new BetterMap<string, { id: number; name: string }>();
      const defaultObj = { id: 1, name: "default" };

      const result = map.getWithDefault("key", defaultObj);
      expect(result).toEqual(defaultObj);
      expect(map.get("key")).toEqual(defaultObj);
    });

    test("works with arrays", () => {
      const map = new BetterMap<string, number[]>();
      const defaultArray = [1, 2, 3];

      const result = map.getWithDefault("key", defaultArray);
      expect(result).toEqual(defaultArray);
      expect(map.get("key")).toEqual(defaultArray);
    });
  });

  describe("map", () => {
    test("maps over all entries with value, key, and index", () => {
      const map = new BetterMap<string, number>();
      map.set("a", 1);
      map.set("b", 2);
      map.set("c", 3);

      const result = Array.from(map.map((value, key, index) => ({ value, key, index })));

      expect(result).toEqual([
        { value: 1, key: "a", index: 0 },
        { value: 2, key: "b", index: 1 },
        { value: 3, key: "c", index: 2 },
      ]);
    });

    test("returns empty array for empty map", () => {
      const map = new BetterMap<string, number>();
      const result = Array.from(map.map((value, key, index) => ({ value, key, index })));

      expect(result).toEqual([]);
    });

    test("works with different transformation functions", () => {
      const map = new BetterMap<string, number>();
      map.set("a", 1);
      map.set("b", 2);

      // Transform to strings
      const stringResult = Array.from(map.map((value) => value.toString()));
      expect(stringResult).toEqual(["1", "2"]);

      // Transform to objects
      const objectResult = Array.from(map.map((value, key) => ({ [key]: value })));
      expect(objectResult).toEqual([{ a: 1 }, { b: 2 }]);

      // Transform with index
      const indexedResult = Array.from(map.map((value, key, index) => `${index}:${key}=${value}`));
      expect(indexedResult).toEqual(["0:a=1", "1:b=2"]);
    });

    test("maintains insertion order", () => {
      const map = new BetterMap<string, number>();
      map.set("first", 1);
      map.set("second", 2);
      map.set("third", 3);

      const result = Array.from(map.map((_, key) => key));
      expect(result).toEqual(["first", "second", "third"]);
    });
  });

  describe("inheritance from Map", () => {
    test("inherits all Map methods", () => {
      const map = new BetterMap<string, number>();

      // Test basic Map methods
      expect(map.set("a", 1)).toBe(map);
      expect(map.get("a")).toBe(1);
      expect(map.has("a")).toBe(true);
      expect(map.size).toBe(1);

      map.delete("a");
      expect(map.has("a")).toBe(false);
      expect(map.size).toBe(0);

      map.set("b", 2);
      map.clear();
      expect(map.size).toBe(0);
    });

    test("works with Map iteration methods", () => {
      const map = new BetterMap<string, number>();
      map.set("a", 1);
      map.set("b", 2);

      const entries = Array.from(map.entries());
      expect(entries).toEqual([
        ["a", 1],
        ["b", 2],
      ]);

      const keys = Array.from(map.keys());
      expect(keys).toEqual(["a", "b"]);

      const values = Array.from(map.values());
      expect(values).toEqual([1, 2]);
    });

    test("works with forEach", () => {
      const map = new BetterMap<string, number>();
      map.set("a", 1);
      map.set("b", 2);

      const result: Array<{ key: string; value: number }> = [];
      map.forEach((value, key) => {
        result.push({ key, value });
      });

      expect(result).toEqual([
        { key: "a", value: 1 },
        { key: "b", value: 2 },
      ]);
    });
  });
});
