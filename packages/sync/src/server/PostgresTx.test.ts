import { describe, expect, layer } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Engines } from "../conformance/Engines.ts";
import { Sync } from "../definition/Sync.ts";
import { Tx } from "../transaction/Tx.ts";
import { PostgresTx } from "./PostgresTx.ts";

const Note = Sync.table("Note", { class: "readable", fields: { text: Schema.String } });

const database = Layer.effectDiscard(
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    Effect.forEach(PostgresTx.schema, (statement) => sql.unsafe(statement), { discard: true }),
  ),
).pipe(Layer.provideMerge(Engines.postgres18Database(Engines.postgres18 ?? "")));

/** One push: a transaction that writes rows into a space through the server's `Tx`. */
const push = (space: string, ids: ReadonlyArray<string>, beforeCommit = Effect.void) =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    sql.withTransaction(
      Effect.gen(function* () {
        const tx = yield* Tx.Service;

        for (const id of ids) yield* tx.put(Note, space, id, { text: id });
        yield* beforeCommit;
      }).pipe(Effect.provide(PostgresTx.layer({ actor: "account", writes: [Note] }))),
    ),
  );

/** What a device's pull reads for one space: rows above its cursor, in version order. */
const pull = (space: string, cursor: number) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly id: string; readonly version: number }>`
      select id, version::int as version from sync_row
      where space_id = ${space} and version > ${cursor}
      order by version, id
    `,
  );

describe.skipIf(Engines.postgres18 === null)("PostgresTx on PostgreSQL 18", () => {
  layer(database)((it) => {
    it.effect(
      "a second writer waits for the first to commit, so versions follow commit order",
      () =>
        Effect.gen(function* () {
          const firstWrote = yield* Deferred.make<void>();
          const commitFirst = yield* Deferred.make<void>();

          const first = yield* Effect.forkChild(
            push(
              "order",
              ["first"],
              Effect.andThen(Deferred.succeed(firstWrote, undefined), Deferred.await(commitFirst)),
            ),
          );

          yield* Deferred.await(firstWrote);
          const second = yield* Effect.forkChild(push("order", ["second"]));

          expect(yield* pull("order", 0)).toEqual([]);
          yield* Deferred.succeed(commitFirst, undefined);
          yield* Fiber.join(first);
          yield* Fiber.join(second);
          expect(yield* pull("order", 0)).toEqual([
            { id: "first", version: 1 },
            { id: "second", version: 2 },
          ]);
        }),
    );

    // The puller polls on purpose: it is the device under test, pulling while writers commit.
    it.effect("a puller following its cursor sees every row, and a push's rows together", () =>
      Effect.gen(function* () {
        const spaces = ["busy-a", "busy-b"];

        const writers = Effect.forEach(
          Array.from({ length: 8 }, (_, writer) => writer),
          (writer) =>
            Effect.forEach(
              Array.from({ length: 25 }, (_, push) => push),
              (index) =>
                push(
                  Arr.getUnsafe(spaces, (writer + index) % spaces.length),
                  [`${writer}-${index}-x`, `${writer}-${index}-y`],
                  Effect.yieldNow,
                ),
              { discard: true },
            ),
          { concurrency: "unbounded", discard: true },
        );

        const done = yield* Deferred.make<void>();

        const puller = (space: string) =>
          Effect.gen(function* () {
            const batches: Array<ReadonlyArray<{ readonly id: string; readonly version: number }>> =
              [];

            let cursor = 0;
            let last = false;

            while (!last) {
              last = yield* Deferred.isDone(done);
              const rows = yield* pull(space, cursor);

              if (rows.length > 0) batches.push(rows);
              cursor = rows.at(-1)?.version ?? cursor;
            }

            return batches;
          });

        const pullers = yield* Effect.forkChild(
          Effect.forEach(spaces, puller, { concurrency: "unbounded" }),
        );

        yield* writers;
        yield* Deferred.succeed(done, undefined);
        const pulled = yield* Fiber.join(pullers);

        for (const [index, space] of spaces.entries()) {
          const batches = Arr.getUnsafe(pulled, index);
          const rows = batches.flat();
          const stored = yield* pull(space, 0);
          expect(rows, `${space}: every row once, in version order`).toEqual(stored);
          const versions = [...new Set(rows.map((row) => row.version))];
          expect(versions, `${space}: no gaps`).toEqual(versions.map((_, at) => at + 1));

          for (const batch of batches) {
            const ids = new Set(batch.map((row) => row.id));

            for (const { id } of batch) {
              expect(
                ids.has(id.replace(/-[xy]$/, "-x")) && ids.has(id.replace(/-[xy]$/, "-y")),
              ).toBe(true);
            }
          }
        }

        expect(pulled.flat(2)).toHaveLength(8 * 25 * 2);
      }),
    );
  });
});
