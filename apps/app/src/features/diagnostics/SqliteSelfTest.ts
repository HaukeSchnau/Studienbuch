import { Replay } from "@stu/sync/conformance";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

import { VirtualDevice } from "../../infra/device/VirtualDevice.ts";
import { MemoryKeychain } from "../../infra/keychain/MemoryKeychain.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { AccountDatabase } from "../../infra/sqlite/AccountDatabase.ts";
import { layer as open } from "../../infra/sqlite/database.ts";

// The SQLite build this device runs: expo-sqlite with SQLCipher on Hermes, the wasm build in its
// worker in a browser. The conformance cases of packages/sync must end here as in the tests, or a
// mutator would do one thing on this device and another on the server. And an account's database
// must open with the device schema and go again, as at sign-in and sign-out.

export * as SqliteSelfTest from "./SqliteSelfTest.ts";

// A fresh database in memory for every run, which nothing else on the device opens.
const scratch = open({ device: VirtualDevice.current, name: "conformance", memory: true }).pipe(
  Layer.provide(MemoryKeychain.layer()),
);

/** Every case with its outcome, and how long the replay took. */
export const replay = Atom.make(Effect.timed(Replay.run.pipe(Effect.provide(scratch))));

const Count = Schema.Tuple([Schema.Struct({ count: Schema.Int })]);

const decodeCount = Schema.decodeUnknownEffect(Count);

// The tables, views and indexes the device schema's migrations created.
const created = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const [{ count }] = yield* decodeCount(
    yield* sql`select count(*) as count from sqlite_master
      where name not like 'sqlite_%' and name not like '__drizzle%'`,
  );

  return count;
});

const accountId = "selbsttest";

/** How many tables, views and indexes an account's database got, once it is deleted again. */
export const accountDatabase = Atom.make(
  Effect.gen(function* () {
    const count = yield* Effect.scoped(
      Effect.flatMap(Layer.build(AccountDatabase.layer(accountId)), (context) =>
        Effect.provide(created, context),
      ),
    );

    yield* AccountDatabase.remove(accountId);

    return count;
  }).pipe(
    Effect.timed,
    Effect.provide(Layers.device({ name: VirtualDevice.current, publicComputer: false })),
  ),
);
