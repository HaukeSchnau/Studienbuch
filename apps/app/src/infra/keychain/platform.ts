import { SecureStoreKeychain } from "./SecureStoreKeychain.ts";

/** The keychain that survives restarts on this platform. `platform.web.ts` is the browser's. */
export const layer = SecureStoreKeychain.layer;

/** How many keychain entries of an earlier install this start removed. */
export const clearedAfterInstall = SecureStoreKeychain.clearedAfterInstall;
