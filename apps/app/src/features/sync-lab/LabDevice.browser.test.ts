import { expect, it } from "@effect/vitest";
import { Faults } from "@stu/sync/lab";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Names } from "../../infra/device/Names.ts";
import { layer as keychain } from "../../infra/keychain/platform.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { layer as open } from "../../infra/sqlite/database.ts";
import { LabAccounts } from "./LabAccounts.ts";
import { LabDevice } from "./LabDevice.ts";

const accountId = "lab-test-lena";
const device = "sync-lab-a";
const database = Names.database(new URL(window.location.origin), device, accountId);

/** Signs in once, then refuses, so a second start shows whether the device signed in again. */
const accounts = (signIns: { count: number }) =>
  Layer.succeed(LabAccounts.Service)({
    signIn: (persona) =>
      Effect.suspend(() => {
        signIns.count += 1;

        return signIns.count === 1
          ? Effect.succeed({
              accountId,
              token: Redacted.make("token"),
              rootKey: crypto.getRandomValues(new Uint8Array(32)),
            })
          : Effect.fail(new LabAccounts.Failed({ persona, cause: "signed in once" }));
      }),
  });

const settled = (lab: LabDevice.LabDevice) =>
  SubscriptionRef.changes(lab.engine).pipe(
    Stream.filter((engine) => engine._tag !== "Starting"),
    Stream.runHead,
    Effect.flatMap(Effect.fromOption),
  );

// A database an older build left, which the migrations can't apply to, as one way a signed-in
// device's engine fails to start.
const leaveStaleDatabase = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`create table sync_meta (left_by_an_older_build integer)`;
}).pipe(
  Effect.provide(open({ device, name: database, memory: false }).pipe(Layer.provide(keychain))),
);

const databaseExists = Effect.promise(async () => {
  const root = await navigator.storage.getDirectory();
  const studienbuch = await root.getDirectoryHandle("studienbuch");
  const own = await studienbuch.getDirectoryHandle(device);
  const names: Array<string> = [];

  for await (const [name] of own.entries()) names.push(name);

  return names.includes(database);
});

it.effect(
  "a wipe deletes what a device whose engine failed after sign-in left, and signs in again",
  () => {
    const signIns = { count: 0 };

    return Effect.gen(function* () {
      yield* leaveStaleDatabase;
      const lab = yield* LabDevice.make(LabDevice.specs.a);

      expect((yield* settled(lab))._tag).toBe("Failed");

      yield* lab.wipe;

      expect([signIns.count, yield* databaseExists]).toEqual([2, false]);
    }).pipe(
      Effect.scoped,
      Effect.provide(accounts(signIns)),
      Effect.provideService(Faults.Allowed, { environment: "development" }),
    );
  },
);

// The Lab's runtime builds its devices on the memo map every atom runtime of the tab shares, where
// the root layout has built the app's own device ("browser") already.
it.effect("a device keeps its session out of the app's device that the tab built first", () =>
  Effect.gen(function* () {
    const memoMap = yield* Layer.makeMemoMap;
    const scope = yield* Effect.scope;

    const app = yield* Layer.buildWithMemoMap(
      SessionStore.layer.pipe(Layer.provideMerge(Layers.device({ name: "browser" }))),
      memoMap,
      scope,
    );

    const lab = yield* LabDevice.make(LabDevice.specs.b).pipe(
      Effect.provideService(Layer.CurrentMemoMap, memoMap),
    );

    expect((yield* settled(lab))._tag).toBe("Running");
    expect(yield* Context.get(app, SessionStore.Service).current).toEqual(Option.none());
  }).pipe(
    Effect.scoped,
    Effect.provideService(LabAccounts.Service, {
      signIn: () =>
        Effect.succeed({
          accountId: "lab-test-lena-b",
          token: Redacted.make("token"),
          rootKey: crypto.getRandomValues(new Uint8Array(32)),
        }),
    }),
    Effect.provideService(Faults.Allowed, { environment: "development" }),
  ),
);
