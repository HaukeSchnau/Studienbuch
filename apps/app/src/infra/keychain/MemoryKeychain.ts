import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { Keychain } from "./Keychain.ts";

/** `Keychain.Store` in memory: what a public computer keeps, and what tests start from. */
export const layer = (entries: Iterable<readonly [string, string]> = []) =>
  Layer.sync(Keychain.Store)(() => {
    const store = new Map(entries);

    return {
      get: (name) => Effect.sync(() => Option.fromNullishOr(store.get(name))),
      set: (name, value) => Effect.sync(() => void store.set(name, value)),
      remove: (name) => Effect.sync(() => void store.delete(name)),
    };
  });

export * as MemoryKeychain from "./MemoryKeychain.ts";
