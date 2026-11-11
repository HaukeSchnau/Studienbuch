import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

import { Names } from "../device/Names.ts";
import { Layers } from "./Layers.ts";

const origin = new URL(window.location.origin);

const device = "shared";

/** The account signs in on the shared device, stores its key and a row, and the tab closes. */
const visit = (accountId: string, publicComputer: boolean) =>
  Effect.gen(function* () {
    const secrets = yield* Ports.DeviceSecrets;
    const sql = yield* SqlClient.SqlClient;

    yield* secrets.set("root-key", crypto.getRandomValues(new Uint8Array(32)));
    yield* sql`insert into base_row (space, tbl, id, version, data) values ('n', 'Homework', 'h', 1, '{}')`;
  }).pipe(
    Effect.provide(
      Layers.account(accountId, publicComputer).pipe(
        Layer.provideMerge(Layers.device({ name: device })),
      ),
    ),
  );

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

const opfsDatabases = Effect.promise(async () => {
  const root = await navigator.storage.getDirectory();
  const studienbuch = await root.getDirectoryHandle("studienbuch", { create: true });
  const shared = await studienbuch.getDirectoryHandle(device, { create: true });
  const names: Array<string> = [];

  for await (const [name] of shared.entries()) names.push(name);

  return names;
});

// On a public computer, closing the tab must leave nothing of the account behind, even on a
// device that keeps another account's data.
it.effect("a public computer's account keeps nothing in IndexedDB or OPFS", () =>
  Effect.gen(function* () {
    yield* visit("lena", false);
    yield* visit("tom", true);

    const entries = yield* keychainEntries;
    const databases = yield* opfsDatabases;

    const rootKey = (accountId: string) =>
      `secret.${Names.secrets(origin, device, accountId)}.root-key`;

    // The same visit by an account the device keeps leaves both, so the checks can see them.
    assert.include(entries, rootKey("lena"));
    assert.include(databases, Names.database(origin, device, "lena"));

    assert.notInclude(entries, rootKey("tom"));
    assert.notInclude(databases, Names.database(origin, device, "tom"));
  }),
);
