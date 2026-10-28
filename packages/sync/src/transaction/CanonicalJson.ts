/**
 * The one text form of a row's JSON. The device's SQLite and the server's Postgres store rows in
 * this form, so the device's optimistic result and the server's result are equal exactly when
 * their canonical texts are equal.
 *
 * Postgres `jsonb` rewrites what it stores (key order, whitespace, `1e+21`, `é`, duplicate
 * keys), SQLite keeps the text it gets. Encoding again after every read removes those differences.
 * Values that the two engines cannot both store are refused before they reach either, on the
 * device, before a command enters the outbox: see {@link Unrepresentable}.
 */
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

export * as CanonicalJson from "./CanonicalJson.ts";

/**
 * SQLite's JSON functions reject documents nested deeper than 1000 levels, and one such row would
 * break every view over its table on the device. Rows need a handful of levels, so the limit sits
 * well below that.
 */
export const maxDepth = 64;

export class Unrepresentable extends Schema.TaggedError<Unrepresentable>()(
  "CanonicalJson.Unrepresentable",
  {
    path: Schema.String,
    reason: Schema.Literals([
      // Postgres rejects U+0000 in text and jsonb.
      "nul",
      // Postgres rejects an unpaired surrogate in jsonb.
      "lone-surrogate",
      // NaN and the infinities have no JSON form.
      "non-finite",
      // Beyond 2^53 a number is no longer exact in JavaScript, and SQLite reads such a literal as
      // a 64-bit integer that the drivers refuse (node:sqlite) or return as a bigint (wa-sqlite).
      "unsafe-integer",
      "too-deep",
      "not-json",
    ]),
  },
) {}

/**
 * Encodes a JSON value: object keys sorted by UTF-16 code unit, an `undefined` member the same as
 * an absent one, no whitespace, numbers in JavaScript's shortest form (`-0` becomes `0`).
 */
export const encode = (value: unknown): Result.Result<string, Unrepresentable> => {
  const text = write(value, "$", 0);
  return typeof text === "string" ? Result.succeed(text) : Result.fail(text);
};

/** Re-encodes JSON text read from storage. */
export const normalize = (text: string): Result.Result<string, Unrepresentable> =>
  Result.try({
    try: () => JSON.parse(text) as unknown,
    catch: () => new Unrepresentable({ path: "$", reason: "not-json" }),
  }).pipe(Result.flatMap(encode));

const write = (value: unknown, path: string, depth: number): string | Unrepresentable => {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) return new Unrepresentable({ path, reason: "non-finite" });
      if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
        return new Unrepresentable({ path, reason: "unsafe-integer" });
      }
      return JSON.stringify(value);
    case "string":
      return checkText(value, path) ?? JSON.stringify(value);
    case "object":
      if (depth >= maxDepth) return new Unrepresentable({ path, reason: "too-deep" });
      return Array.isArray(value)
        ? writeArray(value, path, depth)
        : writeObject(value, path, depth);
    default:
      return new Unrepresentable({ path, reason: "not-json" });
  }
};

const writeArray = (
  items: ReadonlyArray<unknown>,
  path: string,
  depth: number,
): string | Unrepresentable => {
  const parts: Array<string> = [];
  for (let index = 0; index < items.length; index++) {
    const part = write(items[index], `${path}[${index}]`, depth + 1);
    if (typeof part !== "string") return part;
    parts.push(part);
  }
  return `[${parts.join(",")}]`;
};

const writeObject = (value: object, path: string, depth: number): string | Unrepresentable => {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return new Unrepresentable({ path, reason: "not-json" });
  }
  const record = value as Readonly<Record<string, unknown>>;
  const parts: Array<string> = [];
  for (const key of Object.keys(record).sort()) {
    const member = record[key];
    if (member === undefined) continue;
    const memberPath = `${path}.${key}`;
    const keyProblem = checkText(key, memberPath);
    if (keyProblem !== undefined) return keyProblem;
    const part = write(member, memberPath, depth + 1);
    if (typeof part !== "string") return part;
    parts.push(`${JSON.stringify(key)}:${part}`);
  }
  return `{${parts.join(",")}}`;
};

// A loop instead of `String.prototype.isWellFormed`, which Hermes lacks.
const checkText = (text: string, path: string): Unrepresentable | undefined => {
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit === 0) return new Unrepresentable({ path, reason: "nul" });
    if (unit >= 0xdc00 && unit <= 0xdfff) {
      return new Unrepresentable({ path, reason: "lone-surrogate" });
    }
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return new Unrepresentable({ path, reason: "lone-surrogate" });
      }
      index++;
    }
  }
  return undefined;
};
