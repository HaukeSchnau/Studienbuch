import { SqliteClient } from "@effect/sql-sqlite-node";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Replay } from "./Replay.ts";

// A device replays the fixture where the tests can't run. Here it must reproduce every case on a
// build the tests already compared, or a device would report a difference that isn't there.
it.effect("a fresh database reproduces every case of the fixture", () =>
  Effect.gen(function* () {
    const results = yield* Replay.run;

    assert.isAbove(results.length, 0);
    assert.deepStrictEqual(
      results.filter((result) => !result.matches),
      [],
    );
  }).pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))),
);
