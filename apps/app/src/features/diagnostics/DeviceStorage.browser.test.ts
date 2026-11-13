import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { publicComputer } from "../../infra/device/publicComputer.ts";
import { VirtualDevice } from "../../infra/device/VirtualDevice.ts";
import { DeviceStorage } from "./DeviceStorage.ts";

/** Everything in OPFS under this device's directory. */
const deviceFiles = Effect.promise(async () => {
  const root = await navigator.storage.getDirectory();
  const names: Array<string> = [];

  const device = await root
    .getDirectoryHandle("studienbuch")
    .then((studienbuch) => studienbuch.getDirectoryHandle(VirtualDevice.current))
    .catch(() => undefined);

  if (device !== undefined) for await (const [name] of device.entries()) names.push(name);

  return names;
});

// "Dieses Gerät" on a public computer: the start counter lives in the tab's memory, and the browser
// isn't asked to keep the site's storage, so the screen leaves nothing behind either.
it.effect("counts a public computer's starts in memory and asks the browser to keep nothing", () =>
  Effect.gen(function* () {
    const registry = yield* Effect.acquireRelease(
      Effect.sync(() => AtomRegistry.make()),
      (made) => Effect.sync(() => made.dispose()),
    );

    registry.set(publicComputer, true);

    const start = yield* AtomRegistry.getResult(registry, DeviceStorage.thisStart);
    const persistence = yield* AtomRegistry.getResult(registry, DeviceStorage.persistence);

    assert.deepStrictEqual(
      { starts: start.starts, persistence, files: yield* deviceFiles },
      { starts: 1, persistence: "memory only", files: [] },
    );
  }).pipe(Effect.scoped),
);
