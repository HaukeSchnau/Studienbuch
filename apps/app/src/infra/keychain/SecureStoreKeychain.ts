import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as SecureStore from "expo-secure-store";

import { firstStartSinceInstall } from "../device/files.ts";
import { Keychain } from "./Keychain.ts";

// Readable once the phone was unlocked after a restart, so work in the background can open the
// database, and never restored onto another device.
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

// iOS keeps an app's keychain entries after the app is deleted, so a new install would find the
// last one's keys and sessions. The store keeps an index of the names it wrote, and the first start
// of a new install removes them before anything reads the keychain. Once per process: every layer
// built from this one waits for the same removal.
const indexName = "keychain-index";

const parseIndex = (text: string | null): ReadonlyArray<string> => {
  if (text === null) return [];

  try {
    const names: unknown = JSON.parse(text);

    return Array.isArray(names) ? names.filter(Predicate.isString) : [];
  } catch {
    return [];
  }
};

let cleared: Promise<number> | undefined;

const removeLastInstall = async () => {
  const names = parseIndex(await SecureStore.getItemAsync(indexName, options));

  for (const name of names) await SecureStore.deleteItemAsync(name, options);

  await SecureStore.deleteItemAsync(indexName, options);

  return names.length;
};

const clearLastInstall = () =>
  (cleared ??= firstStartSinceInstall() ? removeLastInstall() : Promise.resolve(0));

// Index updates run one after another, so two writes can't drop each other's name.
let indexed: Set<string> | undefined;
let indexing: Promise<unknown> = Promise.resolve();

const updateIndex = (change: (names: Set<string>) => boolean) => {
  const next = indexing.then(async () => {
    indexed ??= new Set(parseIndex(await SecureStore.getItemAsync(indexName, options)));

    if (change(indexed)) {
      await SecureStore.setItemAsync(indexName, JSON.stringify([...indexed]), options);
    }
  });

  indexing = next.catch(() => undefined);

  return next;
};

const attempt = <A>(operation: "get" | "set" | "remove", run: () => Promise<A>) =>
  Effect.tryPromise({
    try: async () => {
      await clearLastInstall();

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
  set: (name, value) =>
    attempt("set", async () => {
      await updateIndex((names) => !names.has(name) && names.add(name) !== undefined);
      await SecureStore.setItemAsync(name, value, options);
    }),
  remove: (name) =>
    attempt("remove", async () => {
      await SecureStore.deleteItemAsync(name, options);
      await updateIndex((names) => names.delete(name));
    }),
});

/** How many entries of an earlier install this start removed, for the diagnostics. */
export const clearedAfterInstall = Effect.tryPromise(clearLastInstall).pipe(
  Effect.orElseSucceed(() => 0),
);

export * as SecureStoreKeychain from "./SecureStoreKeychain.ts";
