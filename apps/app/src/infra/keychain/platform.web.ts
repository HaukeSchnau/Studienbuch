import { IndexedDbKeychain } from "./IndexedDbKeychain.ts";

/** The keychain that survives reloads in a browser. */
export const layer = IndexedDbKeychain.layer;
