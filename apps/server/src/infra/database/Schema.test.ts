import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, layer } from "@effect/vitest";
import { generateDrizzleJson, generateMigration, reconstruct } from "drizzle-kit/api-postgres";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import config from "../../../drizzle.config.ts";

const parseSnapshot = Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown));

layer(NodeServices.layer)("The shipped migrations", (it) => {
  // Tests and the simulation build the engine's tables from their declarations, so the migrations
  // `prepare` applies must hold exactly those.
  it.effect(
    "hold every table the drizzle config declares, so drizzle-kit has nothing to generate",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = path.join(import.meta.dirname, "../../..");
        const folder = path.join(root, config.out ?? "migrations");
        const snapshots = new Map<string, unknown>();

        for (const name of yield* fs.readDirectory(folder)) {
          const file = path.join(folder, name, "snapshot.json");

          if (yield* fs.exists(file)) {
            snapshots.set(name, yield* parseSnapshot(yield* fs.readFileString(file)));
          }
        }

        const modules = yield* Effect.forEach([config.schema ?? []].flat(), (schema) =>
          Effect.promise((): Promise<object> => import(path.join(root, schema))),
        );

        const shipped = yield* Effect.promise(() => reconstruct(Object.fromEntries(snapshots)));

        const current = yield* Effect.promise(() =>
          generateDrizzleJson(Object.assign({}, ...modules)),
        );

        expect(yield* Effect.promise(() => generateMigration(shipped, current))).toEqual([]);
      }),
  );
});
