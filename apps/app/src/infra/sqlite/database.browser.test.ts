import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import { StoragePersistence } from "../offline/StoragePersistence.ts";
import { Layers } from "../runtime/Layers.ts";

// Safari's and WebKit's private windows refuse OPFS with this error. Chromium offers OPFS, so the
// page loses it before anything asks, as in a private window.
Object.defineProperty(navigator.storage, "getDirectory", {
  configurable: true,
  value: () =>
    // oxlint-disable-next-line studienbuch/no-throwing-errors -- the stub rejects as Safari's API does
    Promise.reject(
      new DOMException("The operation failed for an unknown transient reason", "UnknownError"),
    ),
});

const count = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ readonly count: number }>`select count(*) as count from base_row`;

  return row?.count;
});

/** Lena opens her notebook and adds a row; how many rows were there before? */
const visit = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const before = yield* count;

  yield* sql`insert or replace into base_row (space, tbl, id, version, data) values ('n', 'Homework', 'h', 1, '{}')`;

  return before;
}).pipe(Effect.provide(Layers.account("lena")));

it.effect(
  "without OPFS, the account's database lives in memory, signs out, and the device says so",
  () =>
    Effect.gen(function* () {
      const first = yield* visit;
      // The tab reloads: the database opens again.
      const second = yield* visit;

      assert.deepStrictEqual([first, second], [0, 0]);

      yield* Layers.forget("lena");

      assert.strictEqual(yield* StoragePersistence.current(false), "memory only");
    }).pipe(Effect.provide(Layers.device({ name: "private-window", publicComputer: false }))),
);
