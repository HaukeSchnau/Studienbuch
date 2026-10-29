import { describe, expect, layer } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type { Protocol } from "../protocol/Protocol.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Tx } from "../transaction/Tx.ts";
import { Fixture } from "./Fixture.ts";
import { Pull } from "./Pull.ts";
import { Spaces } from "./Spaces.ts";
import { SyncWriter } from "./SyncWriter.ts";

const { contract } = Fixture.definition;

const pull = (
  account: string,
  cursors: ReadonlyArray<typeof Protocol.Cursor.Type>,
  options: {
    readonly limit?: number;
    readonly settledMutationId?: number;
    readonly syncEpoch?: string;
  } = {},
) =>
  Effect.flatMap(Pull.Service, (service) =>
    service.pull(account, {
      clientId: `${account}-client`,
      syncEpoch: options.syncEpoch ?? null,
      contract,
      cursors,
      settledMutationId: options.settledMutationId ?? 0,
      limit: options.limit ?? 1000,
    }),
  );

const int = (minimum: number, maximum: number) =>
  Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum, maximum })));

/** A commit: a space, the new rows it writes and how many of its earlier rows it deletes. */
const commit = Arbitrary.all({ space: int(0, 2), rows: int(1, 4), deletes: int(0, 2) });

let runs = 0;

describe.skipIf(Postgres18.socket === null)("Pull on PostgreSQL 18", () => {
  layer(Fixture.server)((it) => {
    it.effect.prop(
      "pages end at version boundaries and together give the device every live row",
      { commits: Arbitrary.array(commit, { minLength: 1, maxLength: 10 }), limit: int(1, 5) },
      ({ commits, limit }) =>
        Effect.gen(function* () {
          const spaces = yield* Spaces.Service;
          const writer = yield* SyncWriter.Service;
          const sql = yield* SqlClient.SqlClient;
          const run = `paging-${++runs}`;
          const account = `${run}-account`;
          const ids = [0, 1, 2].map((index) => `${run}-${index}`);

          for (const space of ids) {
            yield* spaces.create(space, Fixture.School);
            yield* spaces.addMember(space, account, "reader");
          }

          for (const [index, { space, rows, deletes }] of commits.entries()) {
            const id = Arr.getUnsafe(ids, space);

            yield* writer.write(
              id,
              [Fixture.Lesson],
              Effect.gen(function* () {
                const tx = yield* Tx.Service;
                const existing = yield* tx.list(Fixture.Lesson, id);

                for (const { id: row } of existing.slice(0, deletes)) {
                  yield* tx.remove(Fixture.Lesson, id, row);
                }

                for (let row = 0; row < rows; row++) {
                  yield* tx.put(Fixture.Lesson, id, `${index}-${row}`, { room: "A", day: "mon" });
                }
              }),
            );
          }

          const stored = yield* sql<{
            readonly space: string;
            readonly id: string;
            readonly version: number;
            readonly live: boolean;
          }>`
            select space_id as space, id, version::float8 as version, data is not null as live
            from sync_row where space_id in ${sql.in(ids)}
          `;

          const device = new Map<string, Map<string, number>>();
          const cursors = new Map<string, number>();

          for (let page = 0, more = true; more; page++) {
            expect(page, "the pages end").toBeLessThan(100);

            const response = yield* pull(
              account,
              [...cursors].map(([space, version]) => ({ space, version })),
              { limit },
            );

            const ops = response.patches.flatMap((patch) => patch.ops);
            const versions = new Set(ops.map((op) => op.version));

            // A page holds more than `limit` rows only when one commit wrote them all.
            expect(ops.length <= limit || versions.size === 1, "the page fits").toBe(true);

            for (const patch of response.patches) {
              const before = cursors.get(patch.space) ?? 0;

              // Every version on the page arrives whole: the rows a reset delivers are the live
              // ones, an increment delivers tombstones too.
              for (const version of new Set(patch.ops.map((op) => op.version))) {
                const whole = stored.filter(
                  (row) =>
                    row.space === patch.space &&
                    row.version === version &&
                    (row.live || !patch.reset),
                );

                expect(
                  patch.ops
                    .filter((op) => op.version === version)
                    .map((op) => op.id)
                    .sort(),
                ).toEqual(whole.map((row) => row.id).sort());
              }

              expect(patch.to).toBeGreaterThanOrEqual(before);

              const rows = patch.reset
                ? new Map<string, number>()
                : (device.get(patch.space) ?? new Map());

              for (const op of patch.ops) {
                if (op.row._tag === "Deleted") rows.delete(op.id);
                else rows.set(op.id, op.version);
              }

              device.set(patch.space, rows);
              cursors.set(patch.space, patch.to);
            }

            expect(
              response.lastMutationId === null,
              "the last page carries the last mutation id",
            ).toBe(response.more);

            more = response.more;
          }

          for (const space of ids) {
            const live = stored.filter((row) => row.space === space && row.live);

            expect(new Map(device.get(space))).toEqual(
              new Map(live.map((row) => [row.id, row.version])),
            );
          }
        }),
      { arbitrary: { runs: 25 } },
    );

    it.effect(
      "a new space comes whole without its tombstones, and one the account left is removed",
      () =>
        Effect.gen(function* () {
          const { lena, courseSpace, school } = yield* Fixture.school("leave");
          const spaces = yield* Spaces.Service;
          const writer = yield* SyncWriter.Service;
          const ma = courseSpace("ma");
          yield* spaces.addMember(ma, lena.account, "reader");

          const lessons = [
            { id: "mon-1", row: { room: "A1", day: "mon" } },
            { id: "tue-1", row: { room: "B2", day: "tue" } },
          ];

          yield* writer.reconcile(ma, Fixture.Lesson, lessons);
          yield* writer.reconcile(ma, Fixture.Lesson, [], {
            covers: ({ row }) => row.day === "tue",
          });
          const first = yield* pull(lena.account, []);
          const course = first.patches.find((patch) => patch.space === ma);

          expect(course).toMatchObject({ reset: true, to: 2 });
          expect(course?.ops.map((op) => `${op.id} ${op.row._tag}`)).toEqual(["mon-1 Readable"]);

          const cursors = first.patches.map((patch) => ({ space: patch.space, version: patch.to }));
          expect((yield* pull(lena.account, cursors)).patches).toEqual([]);

          yield* spaces.removeMember(ma, lena.account);
          const after = yield* pull(lena.account, cursors);

          expect(after.removed).toEqual([ma]);
          expect(after.spaces.map((space) => space.id)).toEqual([lena.notebook, school]);
        }),
    );

    it.effect(
      "a cursor, settled id or restore epoch the server never handed out answers EpochChanged",
      () =>
        Effect.gen(function* () {
          const { lena, school } = yield* Fixture.school("rewind");

          const answers = yield* Effect.forEach(
            [
              pull(lena.account, [{ space: school, version: 99 }]),
              pull(lena.account, [], { settledMutationId: 3 }),
              pull(lena.account, [], { syncEpoch: "another" }),
              pull(lena.account, []),
            ],
            (effect) =>
              effect.pipe(
                Effect.as("ok"),
                Effect.catch((error) => Effect.succeed(error._tag)),
              ),
          );

          expect(answers).toEqual([
            "Sync.EpochChanged",
            "Sync.EpochChanged",
            "Sync.EpochChanged",
            "ok",
          ]);
        }),
    );
  });
});
