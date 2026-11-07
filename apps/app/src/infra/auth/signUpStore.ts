import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { Keychain } from "../keychain/Keychain.ts";
import { PendingSignUp } from "./PendingSignUp.ts";

/** A phone keeps the sign-up in its keychain, in the device's entries on this server. */
export const layer = Layer.effect(PendingSignUp.Store)(
  Effect.gen(function* () {
    const keychain = yield* Keychain.Store;
    const device = yield* Device.Service;
    const server = yield* Ports.Server;
    const entry = `sign-up.${Names.device(server.origin, device.name)}`;

    const unavailable = (cause: Keychain.Unavailable) => new PendingSignUp.Unavailable({ cause });

    return {
      get: keychain.get(entry).pipe(Effect.mapError(unavailable)),
      set: (text) => keychain.set(entry, text).pipe(Effect.mapError(unavailable)),
      remove: keychain.remove(entry).pipe(Effect.mapError(unavailable)),
    };
  }),
);
