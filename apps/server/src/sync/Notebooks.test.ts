import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import { Notebook, School, Studienbuch } from "@stu/core";
import { Spaces, SyncEpoch, SyncServer, SyncWriter } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { Migrations } from "../infra/database/Migrations.ts";
import { Notebooks } from "./Notebooks.ts";

/** A database at the release's schema, as `prepare` leaves it. */
const prepared = Layer.effectDiscard(
  Effect.gen(function* () {
    const path = yield* Path.Path;
    yield* Migrations.apply(
      yield* Migrations.read(path.join(import.meta.dirname, "../../migrations")),
    );
    yield* SyncEpoch.initialize;
  }),
).pipe(Layer.provideMerge(Postgres18.database(Postgres18.socket ?? "")));

const writers = SyncServer.writers(Studienbuch.schema).pipe(
  Layer.provideMerge(prepared),
  Layer.provideMerge(NodeServices.layer),
);

describe.skipIf(Postgres18.socket === null)("Notebooks on PostgreSQL 18", () => {
  layer(writers)((it) => {
    it.effect("verify finds a notebook whose space and row name different schools, or no row", () =>
      Effect.gen(function* () {
        const spaces = yield* Spaces.Service;
        const writer = yield* SyncWriter.Service;
        const [here, there] = [School.Id.make("here"), School.Id.make("there")];
        const lena = Notebook.Id.make("lena");
        const tom = Notebook.Id.make("tom");
        const mia = Notebook.Id.make("mia");

        for (const school of [here, there]) yield* spaces.create(school, School.Space);

        for (const notebook of [lena, tom]) yield* Notebooks.create(notebook, here);
        const agreed = yield* Notebooks.mismatched;
        yield* writer.reconcile(tom, Notebook.Row, [{ id: tom, row: { schoolId: there } }]);
        yield* spaces.create(mia, Notebook.Space, { parent: here });

        expect([agreed, yield* Notebooks.mismatched]).toEqual([[], [mia, tom]]);
      }),
    );
  });
});
