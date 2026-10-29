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
    it.effect("finds a marker in a text, JSON or bytes column and names the table", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        yield* sql`create table clean (id text, data jsonb, ct bytea)`;
        yield* sql`create table "leaky row" (id text, data jsonb, ct bytea)`;
        yield* sql`insert into clean values ('a', '{"title":"Mathe"}', '\\x00ff')`;
        expect(yield* Leaks.postgres).toStrictEqual([]);

        yield* sql`insert into "leaky row" (id, ct) values ('b', ${shifted(3)})`;
        yield* sql`insert into "leaky row" (id, data) values ('c', ${`{"ct":"${Base64.encode(shifted(2))}"}`})`;
        yield* sql`insert into "leaky row" (id) values (${`id ${marker}`})`;

        const places = (yield* Leaks.postgres).map((leak) => leak.place);
        expect(places).toStrictEqual([
          "postgres leaky row",
          "postgres leaky row",
          "postgres leaky row",
        ]);
      }),
    );
  });
});
