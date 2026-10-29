import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, layer } from "@effect/vitest";
import { Postgres18 } from "@stu/sync/testing";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as SqlClient from "effect/sql/SqlClient";
import { Migrations } from "./Migrations.ts";

const release = Effect.fnUntraced(function* (migrations: Record<string, string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const folder = yield* fs.makeTempDirectoryScoped();

  for (const [name, sql] of Object.entries(migrations)) {
    yield* fs.makeDirectory(path.join(folder, name));
    yield* fs.writeFileString(path.join(folder, name, "migration.sql"), sql);
  }

  return yield* Migrations.read(folder);
});

const a = "CREATE TABLE a (id int);\n--> statement-breakpoint\nINSERT INTO a VALUES (1);\n";
const b = "CREATE TABLE b (id int);\n";
const first = { "20260101000000_a": a };
const second = { "20260101000000_a": a, "20260102000000_b": b };

describe.skipIf(Postgres18.socket === null)("Migrations", () => {
  layer(NodeServices.layer)((it) => {
    it.layer(Postgres18.database(Postgres18.socket ?? ""), { buildPerTest: true })((it) => {
      it.effect("applies each pending migration once", () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          assert.deepStrictEqual(yield* Migrations.apply(yield* release(first)), [
            "20260101000000_a",
          ]);
          const next = yield* release(second);
          assert.deepStrictEqual(yield* Migrations.apply(next), ["20260102000000_b"]);
          assert.deepStrictEqual(yield* Migrations.apply(next), []);
          assert.deepStrictEqual(yield* sql`SELECT id FROM a`, [{ id: 1 }]);
        }),
      );

      it.effect("applies once when two runs race", () =>
        Effect.gen(function* () {
          const local = yield* release(second);

          const runs = yield* Effect.all([Migrations.apply(local), Migrations.apply(local)], {
            concurrency: 2,
          });

          assert.deepStrictEqual(runs.flat().sort(), ["20260101000000_a", "20260102000000_b"]);
        }),
      );

      it.effect("refuses an applied migration that was edited", () =>
        Effect.gen(function* () {
          yield* Migrations.apply(yield* release(first));
          const edited = yield* release({ "20260101000000_a": `${a}-- edited\n` });
          const error = yield* Effect.flip(Migrations.apply(edited));
          assert.strictEqual(error._tag, "Migrations.HistoryMismatch");
          assert.include(error, { migration: "20260101000000_a", localHash: edited[0]?.hash });
        }),
      );

      it.effect("refuses a deleted applied migration, but not one newer than the release", () =>
        Effect.gen(function* () {
          yield* Migrations.apply(yield* release(second));

          const deleted = yield* Effect.flip(
            Migrations.verify(yield* release({ "20260102000000_b": b })),
          );

          assert.include(deleted, { migration: "20260101000000_a", localHash: null });
          // An older release after a newer one migrated, as in a rollback.
          const older = yield* release(first);
          yield* Migrations.verify(older);
          assert.deepStrictEqual(yield* Migrations.apply(older), []);
        }),
      );

      it.effect("reports the head and the missing migrations", () =>
        Effect.gen(function* () {
          const local = yield* release(second);
          assert.deepStrictEqual(yield* Migrations.status(local), {
            head: null,
            missing: ["20260101000000_a", "20260102000000_b"],
          });
          yield* Migrations.apply(yield* release(first));
          assert.deepStrictEqual(yield* Migrations.status(local), {
            head: "20260101000000_a",
            missing: ["20260102000000_b"],
          });

          const behind = yield* Migrations.requireHead(local).pipe(
            Effect.catchTags({
              "Migrations.SchemaBehind": ({ missing }) => Effect.succeed(missing),
            }),
          );

          assert.deepStrictEqual(behind, ["20260102000000_b"]);
        }),
      );
    });
  });
});
