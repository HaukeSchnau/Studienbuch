/**
 * The plaintext-leak check. The workload writes `marker(n)` into encrypted fields only, so a marker
 * found anywhere the server holds or sees is plaintext that left a device. It is found as text and
 * as bytes, in hex, and in base64 or base64url at any of the three byte alignments.
 */
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Hex from "effect/encoding/Hex";
import * as Result from "effect/Result";
import * as SqlClient from "effect/sql/SqlClient";

export * as Leaks from "./Leaks.ts";

/** What every marker starts with. Readable fields never contain it. */
export const prefix = "stu-plaintext-";

export const marker = (n: number) => `${prefix}${n.toString(36)}`;

/**
 * What a forged command's markers start with. A forged frame carries them on purpose, but the
 * server must store and log nothing of a command it can't read.
 */
export const forgedPrefix = "stu-forged-";

export const forgedMarker = (n: number) => `${forgedPrefix}${n.toString(36)}`;

const utf8 = new TextEncoder();

/**
 * The base64 characters that depend only on the prefix's bytes, when they start `offset` bytes
 * into what is encoded. The characters at either end also depend on the neighbouring bytes.
 */
const stableBase64 = (text: string, encode: (bytes: Uint8Array) => string, offset: number) => {
  const bytes = utf8.encode(text);
  const padded = new Uint8Array(offset + bytes.length);
  padded.set(bytes, offset);
  const first = Math.ceil((offset * 8) / 6);
  const end = Math.floor(((offset + bytes.length) * 8) / 6);

  return encode(padded).slice(first, end);
};

const formsOf = (text: string) => [
  text,
  Hex.encode(text),
  Hex.encode(text).toUpperCase(),
  ...[0, 1, 2].flatMap((offset) => [
    stableBase64(text, Base64.encode, offset),
    stableBase64(text, Base64Url.encode, offset),
  ]),
];

/** Every form an encrypted field's marker takes in text. */
export const forms: ReadonlyArray<string> = formsOf(prefix);

/** The forms of both kinds of marker, for what the server stores and logs. */
export const stored: ReadonlyArray<string> = [...forms, ...formsOf(forgedPrefix)];

export const inText = (text: string, among: ReadonlyArray<string> = forms) =>
  among.some((form) => text.includes(form));

/** Bytes as one character per byte, so the prefix's ASCII and text that bytes hold both show. */
const asText = (bytes: Uint8Array) => {
  let text = "";

  for (const byte of bytes) text += String.fromCharCode(byte);

  return text;
};

export const inBytes = (bytes: Uint8Array, among: ReadonlyArray<string> = forms) =>
  inText(asText(bytes), among);

export interface Leak {
  /** Where, such as `postgres sync_row` or `frame up from device a`. */
  readonly place: string;
  /** The text around the first form found. */
  readonly excerpt: string;
}

/** The leak in `text`, if any, with `place` and an excerpt for the report. */
export const find = (
  place: string,
  text: string,
  among: ReadonlyArray<string> = forms,
): ReadonlyArray<Leak> => {
  for (const form of among) {
    const at = text.indexOf(form);

    if (at !== -1) return [{ place, excerpt: text.slice(Math.max(0, at - 40), at + 80) }];
  }

  return [];
};

const quoted = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

/** `bytea` as `row_to_json` writes it: `\\x` and hex digits, its backslash escaped. */
const hexRuns = /\\\\x((?:[0-9a-fA-F]{2})+)/gu;

/** The leak in a row's JSON, or in the bytes of one of its `bytea` values. */
const findInRow = (place: string, row: string): ReadonlyArray<Leak> => {
  const inText = find(place, row, stored);

  if (inText.length > 0) return inText;

  for (const [, hex = ""] of row.matchAll(hexRuns)) {
    const bytes = Result.getOrUndefined(Hex.decode(hex));

    if (bytes !== undefined && inBytes(bytes, stored))
      return [{ place, excerpt: `bytes \\x${hex.slice(0, 80)}` }];
  }

  return [];
};

/**
 * Every row of every table outside Postgres's own schemas, as `row_to_json` writes it: text and
 * JSON as they are, and bytes as hex, which it also decodes. Both kinds of marker count.
 */
export const postgres = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const tables = yield* sql<{ readonly schema: string; readonly name: string }>`
    select table_schema as schema, table_name as name from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema not in ('pg_catalog', 'information_schema')
      and table_schema not like 'pg\\_toast%'
    order by table_schema, table_name
  `;

  const leaks = yield* Effect.forEach(tables, ({ schema, name }) =>
    Effect.map(
      sql.unsafe<{ readonly row: string }>(
        `select row_to_json(t)::text as row from ${quoted(schema)}.${quoted(name)} as t`,
      ),
      (rows) => rows.flatMap(({ row }) => findInRow(`postgres ${schema}.${name}`, row)),
    ),
  );

  return leaks.flat();
});

/**
 * Sealed rows show the server nothing but their envelope and ciphertext: their table name is
 * empty, because it travels inside the ciphertext, and they carry no readable data. Rows with an
 * empty table name are sealed ones, tombstones included.
 */
export const sealedRows = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const shown = yield* sql<{ readonly space: string; readonly tbl: string; readonly id: string }>`
    select space_id as space, tbl, id from sync_row
    where (envelope is not null or ct is not null or tbl = '') and (tbl <> '' or data is not null)
    order by space_id, tbl, id
  `;

  return shown.map(({ space, tbl, id }): Leak => ({
    place: "postgres sync_row",
    excerpt: `sealed row ${space} ${id} shows table "${tbl}" or readable data`,
  }));
});
