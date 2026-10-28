import { expect, layer } from "@effect/vitest";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { Cases } from "../conformance/Cases.ts";
import { Engines } from "../conformance/Engines.ts";
import { Probe } from "../conformance/Probe.ts";
import { ProbeDevice } from "../conformance/ProbeDevice.ts";
import { Tx } from "../transaction/Tx.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";

/**
 * What the typed view returns for a row the `Tx` returns: its JSON encoding, so `NaN` reads as the
 * string the row codec stored, and an absent field reads as `null`.
 */
const asViewRow = (space: string, id: string, row: Probe.Row) =>
  Effect.map(Probe.encode(row), (json) => ({
    space,
    id,
    // The row codec's encoded side is typed unknown; for the probe it's the row's JSON object.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    ...(json as Probe.Row),
    note: row.note ?? null,
  }));

layer(Engines.deviceLayer)("Drizzle on the device", (it) => {
  it.effect("typed reads through the views return the rows the Tx returns", () =>
    Effect.gen(function* () {
      for (const engine of yield* Engines.Service) {
        const space = Probe.freshSpace();

        const steps = Cases.all.flatMap((each) =>
          each.steps.filter((step) => step.op === "put" || step.op === "seed"),
        );

        yield* Probe.run(engine, space, steps);

        const expected = yield* engine.transaction(
          Effect.flatMap(Tx.Service, (tx) => tx.list(Probe.table, space)),
        );

        const rows = yield* engine.sql(
          Effect.flatMap(DeviceDatabase.make, (db) =>
            db
              .select()
              .from(ProbeDevice.ProbeView)
              .where(eq(ProbeDevice.ProbeView.space, space))
              .orderBy(ProbeDevice.ProbeView.id),
          ),
        );

        expect(rows, engine.name).toEqual(
          yield* Effect.forEach(expected, ({ id, row }) => asViewRow(space, id, row)),
        );

        const grouped = yield* engine.sql(
          Effect.flatMap(DeviceDatabase.make, (db) =>
            db
              .select({
                id: ProbeDevice.ProbeView.id,
                amount: ProbeDevice.ProbeView.amount,
                flag: ProbeDevice.ProbeView.flag,
              })
              .from(ProbeDevice.ProbeView)
              .where(
                and(eq(ProbeDevice.ProbeView.space, space), eq(ProbeDevice.ProbeView.group, "é")),
              )
              .orderBy(ProbeDevice.ProbeView.id),
          ),
        );

        const inGroup = yield* engine.transaction(
          Effect.flatMap(Tx.Service, (tx) =>
            tx.list(Probe.table, space, { index: "group", equals: "é" }),
          ),
        );

        expect(grouped, engine.name).toEqual(
          inGroup.map(({ id, row }) => ({ id, amount: row.amount, flag: row.flag })),
        );
      }
    }),
  );

  it.effect("a read by a declared index uses its partial index on both row tables", () =>
    Effect.gen(function* () {
      for (const engine of yield* Engines.Service) {
        const db = yield* engine.sql(DeviceDatabase.make);

        const query = db
          .select()
          .from(ProbeDevice.ProbeView)
          .where(and(eq(ProbeDevice.ProbeView.space, "s"), eq(ProbeDevice.ProbeView.group, "é")))
          .toSQL();

        const plan = yield* engine.sql(
          Effect.flatMap(SqlClient.SqlClient, (sql) =>
            sql.unsafe<{ readonly detail: string }>(
              `explain query plan ${query.sql}`,
              query.params,
            ),
          ),
        );

        const details = plan.map((step) => step.detail).join("\n");
        expect(details, engine.name).toContain("USING INDEX pending_row_Probe_group");
        expect(details, engine.name).toContain("USING INDEX base_row_Probe_group");
      }
    }),
  );
});
