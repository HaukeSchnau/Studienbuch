import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SecureStore from "expo-secure-store";

import { Keychain } from "./Keychain.ts";

// Readable once the phone was unlocked after a restart, so work in the background can open the
// database, and never restored onto another device.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

/** `Keychain.Store` on expo-secure-store. */
export const layer = Layer.succeed(Keychain.Store)({
  get: (name) =>
    Effect.tryPromise({
      try: () => SecureStore.getItemAsync(name, options),
      catch: (cause) => new Keychain.Unavailable({ operation: "get", cause }),
    }).pipe(Effect.map(Option.fromNullishOr)),
  set: (name, value) =>
    Effect.tryPromise({
      try: () => SecureStore.setItemAsync(name, value, options),
      catch: (cause) => new Keychain.Unavailable({ operation: "set", cause }),
    }),
});

export * as SecureStoreKeychain from "./SecureStoreKeychain.ts";
