/**
 * A notebook's school lives in two places: the space's parent, which membership rules read, and
 * the `Notebook` row, which `enrollment.set` reads. `create` writes both, and `verify` checks that
 * they agree.
 */
import { Notebook } from "@stu/core";
import type { School } from "@stu/core";
import { Spaces, SyncWriter } from "@stu/sync/server";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export * as Notebooks from "./Notebooks.ts";

/** Creates the notebook space under its school with its `Notebook` row, or finds both alike. */
export const create = Effect.fn("Notebooks.create")(function* (
  notebook: Notebook.Id,
  school: School.Id,
) {
  const spaces = yield* Spaces.Service;
  const writer = yield* SyncWriter.Service;
  yield* spaces.create(notebook, Notebook.Space, { parent: school });
  yield* writer.reconcile(notebook, Notebook.Row, [{ id: notebook, row: { schoolId: school } }]);
});

/** Notebooks whose space and `Notebook` row name different schools, or that have no row. */
export const mismatched = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ readonly id: string }>`
    select s.id from space s
    left join sync_row r
      on r.space_id = s.id and r.tbl = ${Notebook.Row.name} and r.id = s.id and r.data is not null
    where s.kind = ${Notebook.Space.name} and (r.data ->> 'schoolId') is distinct from s.parent_id
    order by s.id
  `;

  return rows.map((row) => row.id);
}).pipe(Effect.withSpan("Notebooks.mismatched"));
