import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Socket from "effect/socket/Socket";

import { ApiProtocol } from "../api/ApiProtocol.ts";
import { ServerOrigin } from "../api/ServerOrigin.ts";
import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { DeviceSessions } from "../keychain/DeviceSessions.ts";
import { Keychain } from "../keychain/Keychain.ts";
import { MemoryKeychain } from "../keychain/MemoryKeychain.ts";
import { layer as platformKeychain } from "../keychain/platform.ts";
import { AppLifecycle } from "../lifecycle/AppLifecycle.ts";
import { AccountDatabase } from "../sqlite/AccountDatabase.ts";
import { removeLeftovers } from "../sqlite/database.ts";
import { Forgetting } from "./Forgetting.ts";

// What the app runs on, one set per device: this phone or browser tab, or each virtual device of
// the Sync Lab in one tab. Packages add their layer with one line in `device` or `account`.

export * as Layers from "./Layers.ts";

// Before anyone signs in: finish the sign-outs an earlier run left, and delete what M0 builds kept.
const start = Effect.andThen(Forgetting.resume(AccountDatabase.remove), removeLeftovers);

/**
 * Everything a device has before anyone signs in: the server, the sessions of the accounts signed
 * in here, the app's lifecycle, and HTTP and WebSocket for the engine's connection.
 */
export const device = (options: Device.Options) =>
  Layer.mergeAll(
    AppLifecycle.layer,
    ApiProtocol.httpClient,
    Socket.layerWebSocketConstructorGlobal,
    Layer.effectDiscard(start),
  ).pipe(
    Layer.provideMerge(DeviceSessions.layer),
    Layer.provideMerge(ServerOrigin.layer),
    Layer.provideMerge(options.publicComputer ? MemoryKeychain.layer() : platformKeychain),
    Layer.provideMerge(Device.layer(options)),
  );

const secrets = (accountId: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const device = yield* Device.Service;
      const server = yield* Ports.Server;

      return Keychain.secrets(Names.secrets(server.origin, device.name, accountId));
    }),
  );

/** What a signed-in account adds on top of its device's layers: its secrets and its database. */
export const account = (accountId: string) =>
  Layer.mergeAll(secrets(accountId), AccountDatabase.layer(accountId));

/**
 * Deletes what an account left on this device at sign-out: its database, its secrets and its
 * session, and only its own. Close its `account` layer first.
 */
export const forget = (accountId: string) => Forgetting.forget(accountId, AccountDatabase.remove);
