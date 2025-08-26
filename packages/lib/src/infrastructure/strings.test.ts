import { describe, expect, test } from "vitest";

import { capitalize, hash } from "./strings";

describe("capitalize", () => {
  test("capitalizes first letter and lowercases rest", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("hello world")).toBe("Hello world");
    expect(capitalize("HELLO")).toBe("Hello");
    expect(capitalize("hELLO")).toBe("Hello");
    expect(capitalize("HeLLo WoRLd")).toBe("Hello world");
  });

  test("handles single characters", () => {
    expect(capitalize("a")).toBe("A");
    expect(capitalize("A")).toBe("A");
    expect(capitalize("z")).toBe("Z");
    expect(capitalize("Z")).toBe("Z");
  });

  test("handles empty string", () => {
    expect(capitalize("")).toBe("");
  });

  test("handles null and undefined", () => {
    expect(capitalize(null)).toBe("");
    expect(capitalize(undefined)).toBe("");
  });

  test("handles strings with special characters", () => {
    expect(capitalize("hello!")).toBe("Hello!");
    expect(capitalize("hello-world")).toBe("Hello-world");
    expect(capitalize("hello_world")).toBe("Hello_world");
    expect(capitalize("123hello")).toBe("123hello");
    expect(capitalize("hello123")).toBe("Hello123");
  });

  test("handles strings with numbers", () => {
    expect(capitalize("123")).toBe("123");
    expect(capitalize("1hello")).toBe("1hello");
    expect(capitalize("hello1")).toBe("Hello1");
  });

  test("handles strings with spaces", () => {
    expect(capitalize(" hello")).toBe(" hello");
    expect(capitalize("hello ")).toBe("Hello ");
    expect(capitalize(" hello ")).toBe(" hello ");
  });

  test("handles unicode characters", () => {
    expect(capitalize("café")).toBe("Café");
    expect(capitalize("über")).toBe("Über");
    expect(capitalize("naïve")).toBe("Naïve");
  });
});

describe("hash", () => {
  test("returns 0 for empty string", () => {
    expect(hash("")).toBe(0);
  });

  test("generates consistent hash for same string", () => {
    const str = "hello world";
    const hash1 = hash(str);
    const hash2 = hash(str);
    expect(hash1).toBe(hash2);
  });

  test("generates different hashes for different strings", () => {
    const hash1 = hash("hello");
    const hash2 = hash("world");
    const hash3 = hash("hello world");

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });

  test("handles single characters", () => {
    expect(hash("a")).not.toBe(0);
    expect(hash("A")).not.toBe(0);
    expect(hash("1")).not.toBe(0);
  });

  test("handles special characters", () => {
    expect(hash("!@#$%")).not.toBe(0);
    expect(hash("hello-world")).not.toBe(0);
    expect(hash("hello_world")).not.toBe(0);
  });

  test("handles numbers", () => {
    expect(hash("123")).not.toBe(0);
    expect(hash("0")).not.toBe(0);
    expect(hash("999999")).not.toBe(0);
  });

  test("handles unicode characters", () => {
    expect(hash("café")).not.toBe(0);
    expect(hash("über")).not.toBe(0);
    expect(hash("naïve")).not.toBe(0);
  });

  test("handles very long strings", () => {
    const longString = "a".repeat(1000);
    expect(hash(longString)).not.toBe(0);
  });

  test("case sensitivity", () => {
    const hash1 = hash("hello");
    const hash2 = hash("Hello");
    const hash3 = hash("HELLO");

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });

  test("hash distribution", () => {
    const hashes = new Set<number>();
    const testStrings = [
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "hello",
      "world",
      "test",
      "string",
      "hash",
      "1",
      "2",
      "3",
      "4",
      "5",
      "!@#",
      "$%^",
      "&*(",
      ")_+",
    ];

    for (const str of testStrings) {
      hashes.add(hash(str));
    }

    // Most hashes should be unique (allowing for some collisions)
    expect(hashes.size).toBeGreaterThan(testStrings.length * 0.8);
  });

  test("hash properties", () => {
    // Hash should be a 32-bit integer
    const result = hash("test");
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(-2147483648);
    expect(result).toBeLessThanOrEqual(2147483647);
  });
});
