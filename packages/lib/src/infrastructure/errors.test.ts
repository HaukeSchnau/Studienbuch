import { describe, expect, test } from "vitest";

import { intoError } from "./errors";

describe("intoError", () => {
  test("returns Error instance as-is", () => {
    const originalError = new Error("Test error");
    const result = intoError(originalError);
    expect(result).toBe(originalError);
    expect(result.message).toBe("Test error");
  });

  test("converts string to Error", () => {
    const errorString = "Something went wrong";
    const result = intoError(errorString);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("Something went wrong");
  });

  test("converts number to Error", () => {
    const errorNumber = 42;
    const result = intoError(errorNumber);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("42");
  });

  test("converts boolean to Error", () => {
    const errorBoolean = true;
    const result = intoError(errorBoolean);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("true");
  });

  test("converts null to Error", () => {
    const errorNull = null;
    const result = intoError(errorNull);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("null");
  });

  test("converts undefined to Error", () => {
    const errorUndefined = undefined;
    const result = intoError(errorUndefined);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("undefined");
  });

  test("converts object to Error", () => {
    const errorObject = { key: "value", nested: { prop: 123 } };
    const result = intoError(errorObject);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("[object Object]");
  });

  test("converts array to Error", () => {
    const errorArray = [1, 2, 3, "test"];
    const result = intoError(errorArray);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("1,2,3,test");
  });

  test("converts function to Error", () => {
    const errorFunction = () => "test";
    const result = intoError(errorFunction);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe(`() => "test"`);
  });

  test("converts Symbol to Error", () => {
    const errorSymbol = Symbol("test");
    const result = intoError(errorSymbol);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("Symbol(test)");
  });

  test("converts BigInt to Error", () => {
    const errorBigInt = BigInt(123);
    const result = intoError(errorBigInt);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe("123");
  });

  test("handles custom Error subclasses", () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "CustomError";
      }
    }

    const customError = new CustomError("Custom error message");
    const result = intoError(customError);
    expect(result).toBe(customError);
    expect(result.name).toBe("CustomError");
    expect(result.message).toBe("Custom error message");
  });

  test("handles Error with stack trace", () => {
    const originalError = new Error("Error with stack");
    originalError.stack = "Error: Error with stack\n    at test.js:1:1";

    const result = intoError(originalError);
    expect(result).toBe(originalError);
    expect(result.stack).toBe("Error: Error with stack\n    at test.js:1:1");
  });
});
