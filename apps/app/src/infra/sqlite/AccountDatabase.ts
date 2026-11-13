import { DeviceDatabase, Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { layer as open, remove as removeFile } from "./database.ts";
import type { Databases } from "./Databases.ts";
import migrations from "./migrations/migrations.js";

// The database of the signed-in account on this device (choice 13 of the M1 plan): its own per
// server origin, account and device, so signing in as someone else never opens another account's
// rows. It opens after sign-in, and signing out deletes it.

export * as AccountDatabase from "./AccountDatabase.ts";

const location = Effect.fn("AccountDatabase.location")(function* (
  accountId: string,
  memory: boolean,
) {
  const device = yield* Device.Service;
  const server = yield* Ports.Server;

  return {
    device: device.name,
    name: Names.database(server.origin, device.name, accountId),
    memory,
  } satisfies Databases.Location;
});

/**
 * The account's database as `SqlClient`, with the device schema's migrations applied. A public
 * computer's lives in memory (`Device.PublicComputer`).
 */
export const layer = (accountId: string, memory: boolean) =>
  Layer.unwrap(Effect.map(location(accountId, memory), open)).pipe(
    Layer.tap((context) =>
      DeviceDatabase.migrate(migrations.migrations).pipe(Effect.provide(context)),
    ),
  );

/** Deletes the account's kept database and its key, at sign-out. Close its layer first. */
export const remove = (accountId: string) => Effect.flatMap(location(accountId, false), removeFile);
