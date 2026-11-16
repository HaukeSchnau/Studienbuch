/**
 * Device databases for the engine's tests: a fresh in-memory database on each SQLite build the app
 * ships, migrated with the test domain. A test runs its body once per build, as `Engines` does for
 * the conformance cases.
 */
import { SqliteClient as NodeSqliteClient } from "@effect/sql-sqlite-node";
import { SqliteClient as WasmSqliteClient } from "@effect/sql-sqlite-wasm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Redacted from "effect/Redacted";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import { Engines } from "../../conformance/Engines.ts";
import { DeviceDatabase } from "../DeviceDatabase.ts";
import { Ports } from "../Ports.ts";
import NotesMigrations from "./migrations/migrations.js";

export * as Devices from "./Devices.ts";

export const drivers = ["sqlite-wasm", "sqlite-node"] as const;

export type Driver = (typeof drivers)[number];

/** The account every test device is signed in as. */
export const actor = "account-lena";

const client = (driver: Driver) =>
  driver === "sqlite-wasm"
    ? Layer.unwrap(
        Effect.as(Effect.promise(Engines.installFileFetch), WasmSqliteClient.layerMemory({})),
      )
    : NodeSqliteClient.layer({ filename: ":memory:" });

/**
 * A fresh, migrated database on `client` with a `Reactivity` of its own, as each of the Sync Lab's
 * devices in one tab has.
 */
export const databaseOn = <A, E, R>(client: Layer.Layer<A, E, R>) =>
  Layer.effectDiscard(Effect.orDie(DeviceDatabase.migrate(NotesMigrations.migrations))).pipe(
    Layer.provideMerge(client),
    Layer.provideMerge(Layer.fresh(Reactivity.layer)),
    Layer.orDie,
  );

/** A fresh, migrated database on `driver`. */
export const database = (driver: Driver) => databaseOn(client(driver));

const token = Redacted.make("token-lena");

/** Signed in as `actor`, with a token that never changes. */
export const session = Layer.succeed(Ports.Session, {
  accountId: actor,
  token: Effect.succeedSome(token),
  changes: Stream.make(Option.some(token)),
  ended: Effect.void,
});

/** Secrets in memory, as on a public computer. A test reads them through the same service. */
export const secrets = Layer.sync(Ports.DeviceSecrets, () => {
  const stored = new Map<Ports.SecretName, Uint8Array>();

  return {
    get: (name) => Effect.sync(() => Option.fromNullishOr(stored.get(name))),
    set: (name, value) => Effect.sync(() => void stored.set(name, value)),
    remove: (name) => Effect.sync(() => void stored.delete(name)),
  };
});

/** The account's root key, which every one of its devices holds. */
export const rootKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);

/** Secrets of a device that holds the account's root key, of generation 0. */
export const unlocked = Layer.effect(
  Ports.DeviceSecrets,
  Effect.gen(function* () {
    const held = yield* Ports.DeviceSecrets;
    yield* Effect.orDie(held.set("root-key", rootKey));

    return held;
  }),
).pipe(Layer.provide(secrets));

/**
 * A device whose platform reports no network, so the supervisor never connects: for tests that
 * run rounds themselves through `SyncClient.replicate`.
 */
export const disconnected = Layer.mergeAll(
  Layer.succeed(Ports.Lifecycle, {
    changes: Stream.make({ foreground: true, online: false }),
  }),
  Layer.succeed(Ports.Transport, {
    connect: Effect.die("A disconnected test device tried to connect"),
  }),
);

/** A space the account reads, as a pull would list it. */
export const space = Effect.fnUntraced(function* (id: string, kind: string, role: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`insert into sync_space (id, kind, role) values (${id}, ${kind}, ${role})`;
});

/** A row as the server delivered it, written straight into `base_row`. */
export const baseRow = Effect.fnUntraced(function* (
  space: string,
  table: string,
  id: string,
  data: string,
) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    insert into base_row (space, tbl, id, version, data) values (${space}, ${table}, ${id}, 1, ${data})
  `;
});
