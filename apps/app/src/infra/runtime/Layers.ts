import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Socket from "effect/socket/Socket";

import { ApiProtocol } from "../api/ApiProtocol.ts";
import { ServerOrigin } from "../api/ServerOrigin.ts";
import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { Keychain } from "../keychain/Keychain.ts";
import { MemoryKeychain } from "../keychain/MemoryKeychain.ts";
import { layer as platformKeychain } from "../keychain/platform.ts";
import { AppLifecycle } from "../lifecycle/AppLifecycle.ts";
import { AccountDatabase } from "../sqlite/AccountDatabase.ts";

// What the app runs on, one set per device: this phone or browser tab, or each virtual device of
// the Sync Lab in one tab. Packages add their layer with one line in `device` or `account`.

export * as Layers from "./Layers.ts";

const secrets = Layer.unwrap(
  Effect.gen(function* () {
    const device = yield* Device.Service;
    const server = yield* Ports.Server;

    return Keychain.secrets(Names.secrets(server.origin, device.name));
  }),
);

/**
 * Everything a device has before anyone signs in: the server, the device's secrets, the app's
 * lifecycle, and HTTP and WebSocket for the engine's connection.
 */
export const device = (options: Device.Options) =>
  Layer.mergeAll(
    secrets,
    AppLifecycle.layer,
    ApiProtocol.httpClient,
    Socket.layerWebSocketConstructorGlobal,
  ).pipe(
    Layer.provideMerge(ServerOrigin.layer),
    Layer.provideMerge(options.publicComputer ? MemoryKeychain.layer() : platformKeychain),
    Layer.provideMerge(Device.layer(options)),
  );

/** What a signed-in account adds on top of its device's layers. */
export const account = (accountId: string) => Layer.mergeAll(AccountDatabase.layer(accountId));

/**
 * Deletes what an account left on this device at sign-out: its database and the device's secrets.
 * Close its `account` layer first.
 */
export const forget = Effect.fn("Layers.forget")(function* (accountId: string) {
  const secrets = yield* Ports.DeviceSecrets;

  yield* AccountDatabase.remove(accountId);
  yield* Effect.forEach(Ports.SecretName.literals, secrets.remove, { discard: true });
});
