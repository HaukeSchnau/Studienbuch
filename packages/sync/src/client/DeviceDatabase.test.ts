import { expect, layer } from "@effect/vitest";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Cases } from "../conformance/Cases.ts";
import { Engines } from "../conformance/Engines.ts";
import { Probe } from "../conformance/Probe.ts";
import { ProbeView } from "../conformance/ProbeDevice.ts";
import { Tx } from "../transaction/Tx.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";

/**
 * What the typed view returns for a row the `Tx` returns: its JSON encoding, so `NaN` reads as the
 * string the row codec stored, and an absent field reads as `null`.
 */
const asViewRow = (space: string, id: string, row: Probe.Row) =>
  Effect.map(Schema.encodeEffect(Probe.table.codec)(row), (json) => ({
    space,
    id,
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
            db.select().from(ProbeView).where(eq(ProbeView.space, space)).orderBy(ProbeView.id),
          ),
        );
        expect(rows, engine.name).toEqual(
          yield* Effect.forEach(expected, ({ id, row }) => asViewRow(space, id, row)),
        );
        const grouped = yield* engine.sql(
          Effect.flatMap(DeviceDatabase.make, (db) =>
            db
              .select({ id: ProbeView.id, amount: ProbeView.amount, flag: ProbeView.flag })
              .from(ProbeView)
              .where(and(eq(ProbeView.space, space), eq(ProbeView.group, "é")))
              .orderBy(ProbeView.id),
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
          .from(ProbeView)
          .where(and(eq(ProbeView.space, "s"), eq(ProbeView.group, "é")))
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
