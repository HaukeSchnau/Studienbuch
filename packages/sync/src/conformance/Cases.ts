/**
 * Hand-written conformance cases, one per difference the engines showed or could show. The
 * conformance test runs them on every engine and writes them with their outcomes to
 * `cases.jsonl`, which a device replays on expo-sqlite.
 */
import type * as Schema from "effect/Schema";
import type { Probe } from "./Probe.ts";

export * as Cases from "./Cases.ts";

export interface Case {
  readonly name: string;
  readonly steps: ReadonlyArray<Probe.Step>;
}

const row = (fields: Partial<Probe.Row> = {}): Probe.Row => ({
  text: "",
  amount: 0,
  flag: false,
  nested: null,
  group: "",
  key: null,
  ...fields,
});

const putAll = (rows: Record<string, Partial<Probe.Row>>): ReadonlyArray<Probe.Step> =>
  Object.entries(rows).map(([id, fields]) => ({ op: "put", id, row: row(fields) }));

const getAll = (ids: ReadonlyArray<string>): ReadonlyArray<Probe.Step> =>
  ids.map((id) => ({ op: "get", id }));

export const all: ReadonlyArray<Case> = [
  {
    name: "an absent field and a null field stay apart",
    steps: [
      ...putAll({ absent: {}, nil: { note: null }, set: { note: "x" } }),
      ...getAll(["absent", "nil", "set"]),
    ],
  },
  {
    name: "a patch with an undefined field makes it absent",
    steps: [
      { op: "put", id: "a", row: row({ note: "x", text: "keep" }) },
      { op: "patch", id: "a", fields: {}, unset: ["note"] },
      { op: "get", id: "a" },
      { op: "patch", id: "a", fields: { note: null } },
      { op: "get", id: "a" },
    ],
  },
  {
    name: "a patch keeps the fields a newer app version wrote",
    steps: [
      {
        op: "seed",
        id: "a",
        json: { ...row({ text: "old" }), future: { added: [1, "two"] }, zeta: true },
      },
      { op: "patch", id: "a", fields: { text: "new" } },
      { op: "get", id: "a" },
    ],
  },
  {
    name: "a put drops the fields a newer app version wrote",
    steps: [
      { op: "seed", id: "a", json: { ...row(), future: 1 } },
      { op: "put", id: "a", row: row({ text: "replaced" }) },
    ],
  },
  {
    name: "integers up to 2^53 - 1 round-trip, larger ones are refused",
    steps: [
      ...putAll({
        max: { amount: Number.MAX_SAFE_INTEGER },
        min: { amount: -Number.MAX_SAFE_INTEGER },
        nested: { nested: [Number.MAX_SAFE_INTEGER, { n: -Number.MAX_SAFE_INTEGER }] },
        over: { amount: 2 ** 53 },
        far: { amount: 2 ** 60 },
        huge: { amount: 1e21 },
        largest: { amount: Number.MAX_VALUE },
      }),
      { op: "list" },
    ],
  },
  {
    name: "decimals keep their value",
    steps: [
      ...putAll({
        half: { amount: 12.5 },
        tenth: { amount: 0.1 },
        sum: { amount: 0.1 + 0.2 },
        small: { amount: 1e-7 },
        smallest: { amount: 5e-324 },
        negative: { amount: -0.000001 },
        third: { amount: 1 / 3 },
      }),
      { op: "list" },
    ],
  },
  {
    name: "the row codec stores NaN and the infinities as text",
    steps: [
      { op: "put", id: "nan", row: row({ amount: Number.NaN }) },
      { op: "put", id: "inf", row: row({ amount: Number.POSITIVE_INFINITY }) },
      { op: "list" },
    ],
  },
  {
    name: "unicode text round-trips",
    steps: [
      ...putAll({
        accent: { text: "é" },
        combining: { text: "é" },
        ligature: { text: "ﬀ" },
        astral: { text: "😀 𝄞" },
        separators: { text: "  " },
        controls: { text: "\u0001\t\n\r\u001f\u007f" },
        escapes: { text: '"\\/\b\f' },
        private: { text: "￿" },
        rtl: { text: "שלום مرحبا" },
      }),
      { op: "list" },
    ],
  },
  {
    name: "text that Postgres can't store is refused on every engine",
    steps: [
      { op: "put", id: "nul", row: row({ text: "a\u0000b" }) },
      { op: "put", id: "high", row: row({ text: "\ud800" }) },
      { op: "put", id: "low", row: row({ text: "x\udc00" }) },
      { op: "put", id: "key", row: row({ nested: { "a\u0000": 1 } }) },
      { op: "list" },
    ],
  },
  {
    name: "object keys come back sorted, whatever order they went in",
    steps: [
      {
        op: "put",
        id: "a",
        row: row({ nested: { b: 1, a: { d: [1], c: 2 }, aa: 3, B: 4, "10": 5, "9": 6, é: 7 } }),
      },
      { op: "get", id: "a" },
    ],
  },
  {
    name: "nested arrays round-trip",
    steps: [
      { op: "put", id: "a", row: row({ nested: [[[]], [1, [2, [3, [{}]]]], [null, true]] }) },
      { op: "get", id: "a" },
    ],
  },
  {
    name: "nesting deeper than 64 levels is refused",
    steps: [
      { op: "put", id: "ok", row: row({ nested: nest(62) }) },
      { op: "put", id: "deep", row: row({ nested: nest(63) }) },
      { op: "list" },
    ],
  },
  {
    name: "a field named __proto__ stays a field",
    steps: [
      {
        op: "put",
        id: "a",
        row: row({ nested: JSON.parse('{"__proto__":{"x":1}}') as Schema.Json }),
      },
      {
        op: "seed",
        id: "b",
        json: JSON.parse(`{${JSON.stringify(row()).slice(1, -1)},"__proto__":1}`) as Schema.Json,
      },
      { op: "patch", id: "b", fields: { text: "patched" } },
      { op: "get", id: "a" },
      { op: "get", id: "b" },
    ],
  },
  {
    name: "rows list in UTF-8 byte order of their ids",
    steps: [
      ...putAll({ a: {}, B: {}, _c: {}, é: {}, é: {}, ﬀ: {}, "😀": {}, "": {} }),
      ...putAll({ Z: {}, "10": {}, "9": {}, "a b": {}, "": {} }),
      { op: "list" },
    ],
  },
  {
    name: "an index matches JSON values exactly",
    steps: [
      ...putAll({
        one: { key: 1 },
        oneFloat: { key: 1.0 },
        oneText: { key: "1" },
        yes: { key: true },
        yesText: { key: "true" },
        list: { key: [1] },
        object: { key: { a: 1 } },
        objectText: { key: '{"a":1}' },
        nil: { key: null },
        absentKey: {},
      }),
      ...[1, "1", true, "true", [1], { a: 1 }, '{"a":1}', null, false, 0].map(
        (equals): Probe.Step => ({ op: "list", where: { index: "key", equals } }),
      ),
    ],
  },
  {
    name: "an index on text and on numbers",
    steps: [
      ...putAll({
        a: { group: "é", amount: 12.5 },
        b: { group: "é", amount: 12.5 },
        c: { group: "É", amount: 1e-7 },
        d: { group: "é", amount: -0 },
      }),
      { op: "list", where: { index: "group", equals: "é" } },
      { op: "list", where: { index: "group", equals: "é" } },
      { op: "list", where: { index: "amount", equals: 12.5 } },
      { op: "list", where: { index: "amount", equals: 1e-7 } },
      { op: "list", where: { index: "amount", equals: 0 } },
    ],
  },
  {
    name: "insert refuses an existing row, put replaces it",
    steps: [
      { op: "insert", id: "a", row: row({ text: "first" }) },
      { op: "insert", id: "a", row: row({ text: "second" }) },
      { op: "put", id: "a", row: row({ text: "third" }) },
      { op: "get", id: "a" },
    ],
  },
  {
    name: "a patch on a missing row fails, a remove of one succeeds",
    steps: [
      { op: "patch", id: "missing", fields: { text: "x" } },
      { op: "remove", id: "missing" },
      { op: "get", id: "missing" },
    ],
  },
  {
    name: "a removed row disappears, also when the server delivered it",
    steps: [
      { op: "seed", id: "server", json: row({ text: "from the server" }) },
      { op: "put", id: "local", row: row({ text: "local" }) },
      { op: "remove", id: "server" },
      { op: "remove", id: "local" },
      { op: "get", id: "server" },
      { op: "list" },
      { op: "insert", id: "server", row: row({ text: "again" }) },
      { op: "list" },
    ],
  },
  {
    name: "a sequence of patches",
    steps: [
      { op: "put", id: "a", row: row() },
      { op: "patch", id: "a", fields: { text: "one", amount: 1 } },
      { op: "patch", id: "a", fields: { nested: { b: [2], a: 1 }, note: "n" } },
      { op: "patch", id: "a", fields: { amount: 0.5 }, unset: ["note"] },
      { op: "patch", id: "a", fields: { flag: true, key: { z: null } } },
      { op: "get", id: "a" },
    ],
  },
];

function nest(depth: number): Schema.Json {
  return depth === 0 ? [] : [nest(depth - 1)];
}
