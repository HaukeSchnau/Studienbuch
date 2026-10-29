import { PgliteClient } from "@effect/sql-pglite";
import { describe, expect, it, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Hex from "effect/encoding/Hex";
import * as Random from "effect/Random";
import * as SqlClient from "effect/sql/SqlClient";
import { Leaks } from "./Leaks.ts";

const utf8 = new TextEncoder();

const marker = Leaks.marker(42);

/** The marker's UTF-8 bytes after `offset` other bytes, as an encoder sees them in a longer value. */
const shifted = (offset: number) => utf8.encode(`${"x".repeat(offset)}${marker} and more`);

describe("Leaks", () => {
  it("finds a marker as text, hex, and base64 or base64url at every alignment", () => {
    expect(Leaks.inText(JSON.stringify({ title: `Buy ${marker}` }))).toBe(true);
    expect(Leaks.inText(Hex.encode(marker))).toBe(true);
    expect(Leaks.inText(Hex.encode(marker).toUpperCase())).toBe(true);

    for (const offset of [0, 1, 2, 3, 4]) {
      expect(Leaks.inText(Base64.encode(shifted(offset)))).toBe(true);
      expect(Leaks.inText(Base64Url.encode(shifted(offset)))).toBe(true);
    }

    expect(Leaks.inBytes(shifted(5))).toBe(true);
    expect(Leaks.inBytes(utf8.encode(Base64.encode(shifted(1))))).toBe(true);
  });

  it.effect("finds nothing in random bytes, whatever their encoding", () =>
    Effect.gen(function* () {
      const bytes = new Uint8Array(65_536);

      for (let index = 0; index < bytes.length; index++) {
        bytes[index] = yield* Random.nextIntBetween(0, 255);
      }

      expect(Leaks.inBytes(bytes)).toBe(false);
      expect(Leaks.inText(Base64.encode(bytes))).toBe(false);
      expect(Leaks.inText(Base64Url.encode(bytes))).toBe(false);
      expect(Leaks.inText(Hex.encode(bytes))).toBe(false);
    }).pipe(Random.withSeed("leaks")),
  );

  layer(PgliteClient.layer({}))("in Postgres", (it) => {
    it.effect(
      "finds a marker in a text, JSON or bytes column of any schema and names the table",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          yield* sql`create schema archive`;
          yield* sql`create table clean (id text, data jsonb, ct bytea)`;
          yield* sql`create table "leaky row" (id text, data jsonb, ct bytea)`;
          yield* sql`create table archive.old (id text, ct bytea)`;
          yield* sql`insert into clean values ('a', '{"title":"Mathe"}', '\\x00ff')`;
          expect(yield* Leaks.postgres).toStrictEqual([]);

          yield* sql`insert into "leaky row" (id, ct) values ('b', ${shifted(3)})`;
          yield* sql`insert into "leaky row" (id, data) values ('c', ${`{"ct":"${Base64.encode(shifted(2))}"}`})`;
          yield* sql`insert into "leaky row" (id) values (${`id ${marker}`})`;
          // Bytes that hold the base64 text of plaintext, which only decoding the hex shows.
          yield* sql`insert into archive.old (id, ct) values ('d', ${utf8.encode(Base64.encode(shifted(1)))})`;

          const places = (yield* Leaks.postgres).map((leak) => leak.place);
          expect(places).toStrictEqual([
            "postgres archive.old",
            "postgres public.leaky row",
            "postgres public.leaky row",
            "postgres public.leaky row",
          ]);
        }),
    );

    it.effect("finds a sealed row that shows its table or readable data", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        // The columns of the server's `sync_row` that the check reads.
        yield* sql`create table sync_row (space_id text, tbl text, id text, data jsonb, envelope jsonb, ct bytea)`;
        yield* sql`insert into sync_row values ('notebook-lena', '', 'sealed', null, '{"format":1}', '\\x00')`;
        yield* sql`insert into sync_row values ('notebook-lena', '', 'deleted', null, '{"format":1}', null)`;
        yield* sql`insert into sync_row values ('notebook-lena', 'Enrollment', 'readable', '{}', null, null)`;
        expect(yield* Leaks.sealedRows).toStrictEqual([]);

        yield* sql`insert into sync_row values ('notebook-lena', 'Homework', 'named', null, '{"format":1}', '\\x00')`;
        yield* sql`insert into sync_row values ('notebook-lena', '', 'with data', '{}', '{"format":1}', '\\x00')`;

        const shown = (yield* Leaks.sealedRows).map((leak) => leak.excerpt);
        expect(shown).toStrictEqual([
          'sealed row notebook-lena with data shows table "" or readable data',
          'sealed row notebook-lena named shows table "Homework" or readable data',
        ]);
      }),
    );
  });
});
