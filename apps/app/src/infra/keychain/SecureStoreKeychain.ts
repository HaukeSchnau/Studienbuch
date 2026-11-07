import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SecureStore from "expo-secure-store";

import { clearKeychainAfterInstall } from "../device/files.ts";
import { Keychain } from "./Keychain.ts";

// Readable once the phone was unlocked after a restart, so work in the background can open the
// database, and never restored onto another device.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

// expo-secure-store's iOS keychain services when no `keychainService` is set: the plain one, and
// one each for entries with and without authentication (`query` in its `SecureStoreModule.swift`).
const services = ["app", "app:no-auth", "app:auth"];

let cleared: number | undefined;

// iOS keeps an app's keychain entries after the app is deleted. The first keychain call of a new
// install deletes what the last one left, in one native call, before anything reads it.
const clearLastInstall = () => (cleared ??= clearKeychainAfterInstall(services));

const attempt = <A>(operation: Keychain.Unavailable["operation"], run: () => Promise<A>) =>
  Effect.tryPromise({
    try: () => {
      clearLastInstall();

      return run();
    },
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

/** How many entries of an earlier install this start removed, for the diagnostics. */
export const clearedAfterInstall = Effect.try(clearLastInstall).pipe(Effect.orElseSucceed(() => 0));

export * as SecureStoreKeychain from "./SecureStoreKeychain.ts";
