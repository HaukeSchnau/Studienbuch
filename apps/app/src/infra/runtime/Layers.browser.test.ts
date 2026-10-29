import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import { Names } from "../device/Names.ts";
import { Layers } from "./Layers.ts";

const origin = new URL(window.location.origin);

const signedIn = (device: string, publicComputer: boolean) =>
  Layers.account("lena").pipe(Layer.provideMerge(Layers.device({ name: device, publicComputer })));

/** Lena signs in, the engine stores her key and a row, and the tab closes. */
const visit = (device: string, publicComputer: boolean) =>
  Effect.gen(function* () {
    const secrets = yield* Ports.DeviceSecrets;
    const sql = yield* SqlClient.SqlClient;

    yield* secrets.set("root-key", crypto.getRandomValues(new Uint8Array(32)));
    yield* sql`insert into base_row (space, tbl, id, version, data) values ('n', 'Homework', 'h', 1, '{}')`;
  }).pipe(Effect.provide(signedIn(device, publicComputer)));

const keychainEntries = Effect.promise(
  () =>
    new Promise<ReadonlyArray<IDBValidKey>>((resolve, reject) => {
      const open = indexedDB.open("studienbuch-keychain");

      open.addEventListener("error", () => reject(open.error));
      open.addEventListener("success", () => {
        const keys = open.result.transaction("entries").objectStore("entries").getAllKeys();

        keys.addEventListener("error", () => reject(keys.error));
        keys.addEventListener("success", () => {
          open.result.close();
          resolve(keys.result);
        });
      });
    }),
);

const opfsDevices = Effect.promise(async () => {
  const root = await navigator.storage.getDirectory();
  const studienbuch = await root.getDirectoryHandle("studienbuch", { create: true });
  const names: Array<string> = [];

  for await (const [name] of studienbuch.entries()) names.push(name);

  return names;
});

// On a public computer, closing the tab must leave nothing of the account behind.
it.effect("a public computer keeps nothing of the account in IndexedDB or OPFS", () =>
  Effect.gen(function* () {
    yield* visit("own", false);
    yield* visit("public", true);

    const entries = yield* keychainEntries;
    const devices = yield* opfsDevices;

    const rootKey = (device: string) => `secret.${Names.secrets(origin, device, "lena")}.root-key`;

    // The same visit on a device of its own leaves both, so the checks can see them.
    assert.include(entries, rootKey("own"));
    assert.include(devices, "own");

    assert.notInclude(entries, rootKey("public"));
    assert.notInclude(devices, "public");
  }),
);
