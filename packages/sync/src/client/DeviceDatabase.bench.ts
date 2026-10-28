/**
 * What a typed read costs on the device's two SQLite builds: Effect's `sql` alone, Drizzle on its
 * Effect session (`DeviceDatabase`), and Drizzle's `sqlite-proxy` driver bridged to the same Effect
 * client through promises, which D53 first named. Run with `vp test bench`.
 */
import { SqliteClient as NodeSqliteClient } from "@effect/sql-sqlite-node";
import { SqliteClient as WasmSqliteClient } from "@effect/sql-sqlite-wasm";
import { and, eq, sql } from "drizzle-orm";
import { drizzle as drizzleProxy } from "drizzle-orm/sqlite-proxy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as SqlClient from "effect/sql/SqlClient";
import { test } from "vitest";
import { Engines } from "../conformance/Engines.ts";
import ProbeMigrations from "../conformance/migrations/migrations.js";
import { ProbeView } from "../conformance/ProbeDevice.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";

await Engines.installFileFetch();

const rows = 1_000;
const groups = 20;

const seed = Effect.gen(function* () {
  yield* DeviceDatabase.migrate(ProbeMigrations.migrations);
  const sql = yield* SqlClient.SqlClient;
  const data = Array.from({ length: rows }, (_, index) => ({
    id: `row-${String(index).padStart(4, "0")}`,
    data: JSON.stringify({
      amount: index / 7,
      flag: index % 2 === 0,
      group: `group-${index % groups}`,
      key: { index },
      nested: [index, { deep: [index] }],
      text: `Hausaufgabe ${index}`,
    }),
  }));
  yield* sql`
    insert into base_row (space, tbl, id, version, data)
    select 'bench', 'Probe', value ->> '$.id', 1, value ->> '$.data' from json_each(${JSON.stringify(data)})
  `;
});

const runtimeOf = (layer: Layer.Layer<SqlClient.SqlClient, unknown>) => {
  const runtime = ManagedRuntime.make(layer);
  return runtime.runPromise(seed).then(() => runtime);
};

const builds = [
  ["sqlite-wasm", await runtimeOf(WasmSqliteClient.layerMemory({}))],
  ["sqlite-node", await runtimeOf(NodeSqliteClient.layer({ filename: ":memory:" }))],
] as const;

for (const [name, runtime] of builds) {
  const client = await runtime.runPromise(SqlClient.SqlClient);
  const effectDb = await runtime.runPromise(DeviceDatabase.make);
  // The proxy's callbacks return promises, so each query leaves the caller's fiber: no typed error,
  // no transaction, no span.
  const query = (sql: string, params: Array<unknown>, rowMode?: "array" | "object") =>
    runtime.runPromise(
      rowMode === "object"
        ? client.unsafe(sql, params).withoutTransform
        : client.unsafe(sql, params).values,
    ) as Promise<Array<never>>;
  const proxyDb = drizzleProxy({
    all: query,
    get: (sql, params, rowMode) => query(sql, params, rowMode).then((result) => result[0]) as never,
    run: (sql, params) => runtime.runPromise(client.unsafe(sql, params).raw),
  });

  const byId = and(eq(ProbeView.space, "bench"), eq(ProbeView.id, "row-0500"));
  const byGroup = and(eq(ProbeView.space, "bench"), eq(ProbeView.group, "group-7"));
  const preparedById = effectDb
    .select()
    .from(ProbeView)
    .where(and(eq(ProbeView.space, "bench"), eq(ProbeView.id, sql.placeholder("id"))))
    .prepare();
  const preparedByGroup = effectDb
    .select()
    .from(ProbeView)
    .where(and(eq(ProbeView.space, "bench"), eq(ProbeView.group, sql.placeholder("group"))))
    .prepare();

  test(`${name}: one row by id`, async ({ bench }) => {
    await bench.compare(
      bench("Effect sql", () =>
        runtime.runPromise(
          client`select * from "Probe" where space = 'bench' and id = 'row-0500'`,
        )),
      bench("Drizzle on the Effect session", () =>
        runtime.runPromise(effectDb.select().from(ProbeView).where(byId))),
      bench("Drizzle sqlite-proxy", () => proxyDb.select().from(ProbeView).where(byId)),
      bench("Drizzle on the Effect session, prepared", () =>
        runtime.runPromise(preparedById.execute({ id: "row-0500" }))),
    );
  });

  test(`${name}: 50 rows by an indexed field`, async ({ bench }) => {
    await bench.compare(
      bench("Effect sql", () =>
        runtime.runPromise(
          client`select * from "Probe" where space = 'bench' and "group" = 'group-7'`,
        )),
      bench("Drizzle on the Effect session", () =>
        runtime.runPromise(effectDb.select().from(ProbeView).where(byGroup))),
      bench("Drizzle sqlite-proxy", () => proxyDb.select().from(ProbeView).where(byGroup)),
      bench("Drizzle on the Effect session, prepared", () =>
        runtime.runPromise(preparedByGroup.execute({ group: "group-7" }))),
    );
  });
}
