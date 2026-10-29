import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, layer } from "@effect/vitest";
import { Notebook, School, Studienbuch } from "@stu/core";
import { Spaces, SyncServer, SyncWriter } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Testing } from "../infra/database/Testing.ts";
import { Notebooks } from "./Notebooks.ts";

const writers = SyncServer.writers(Studienbuch.schema).pipe(
  Layer.provideMerge(Testing.prepared),
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
