/**
 * Device databases for the engine's tests: a fresh in-memory database on each SQLite build the app
 * ships, migrated with the test domain. A test runs its body once per build, as `Engines` does for
 * the conformance cases.
 */
import { SqliteClient as NodeSqliteClient } from "@effect/sql-sqlite-node";
import { SqliteClient as WasmSqliteClient } from "@effect/sql-sqlite-wasm";
import { CryptoSuite } from "@stu/e2ee";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import * as Reactivity from "effect/reactivity/Reactivity";
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
 * A fresh, migrated database with a `Reactivity` of its own, as each of the Sync Lab's devices in
 * one tab has.
 */
export const database = (driver: Driver) =>
  Layer.effectDiscard(Effect.orDie(DeviceDatabase.migrate(NotesMigrations.migrations))).pipe(
    Layer.provideMerge(client(driver)),
    Layer.provideMerge(Layer.fresh(Reactivity.layer)),
    Layer.orDie,
  );

/** Signed in as `actor`, with a token that never changes. */
export const session = Layer.succeed(Ports.Session, {
  accountId: actor,
  token: Effect.succeedNone,
  changes: Stream.make(Option.none()),
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

/**
 * A `CryptoSuite` whose generator follows Effect's `Random`, for the engine's ids. The engine's
 * other operations need WP-2's suite, which replaces this once its test layer is on main.
 */
export const crypto = Layer.succeed(
  CryptoSuite.Service,
  CryptoSuite.Service.of({
    randomBytes: (length) =>
      Effect.map(Effect.all(Array.from({ length }, () => Random.nextIntBetween(0, 255))), (bytes) =>
        Uint8Array.from(bytes),
      ),
    sha256: () => Effect.die("Not in the test suite"),
    hmac: () => Effect.die("Not in the test suite"),
    hkdf: () => Effect.die("Not in the test suite"),
    aead: {
      seal: () => Effect.die("Not in the test suite"),
      open: () => Effect.die("Not in the test suite"),
    },
    sign: {
      publicKey: () => Effect.die("Not in the test suite"),
      sign: () => Effect.die("Not in the test suite"),
      verify: () => Effect.die("Not in the test suite"),
    },
    kem: {
      publicKey: () => Effect.die("Not in the test suite"),
      encapsulate: () => Effect.die("Not in the test suite"),
      decapsulate: () => Effect.die("Not in the test suite"),
    },
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
