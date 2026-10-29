import * as Effect from "effect/Effect";

import { IndexedDbKeychain } from "./IndexedDbKeychain.ts";

/** The keychain that survives reloads in a browser. */
export const layer = IndexedDbKeychain.layer;

/** A browser deletes a site's IndexedDB with the rest of its data, so nothing outlives it. */
export const clearedAfterInstall = Effect.succeed(0);
