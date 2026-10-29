import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SecureStore from "expo-secure-store";

import { Keychain } from "./Keychain.ts";

// Readable once the phone was unlocked after a restart, so work in the background can open the
// database, and never restored onto another device.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const attempt = <A>(operation: "get" | "set" | "remove", run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new Keychain.Unavailable({ operation, cause }),
  });

/** `Keychain.Store` on expo-secure-store, for iOS and Android. */
export const layer = Layer.succeed(Keychain.Store)({
  get: (name) =>
    attempt("get", () => SecureStore.getItemAsync(name, options)).pipe(
      Effect.map(Option.fromNullishOr),
    ),
  set: (name, value) => attempt("set", () => SecureStore.setItemAsync(name, value, options)),
  remove: (name) => attempt("remove", () => SecureStore.deleteItemAsync(name, options)),
});

export * as SecureStoreKeychain from "./SecureStoreKeychain.ts";
