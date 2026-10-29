import { SecureStoreKeychain } from "./SecureStoreKeychain.ts";

/** The keychain that survives restarts on this platform. `platform.web.ts` is the browser's. */
export const layer = SecureStoreKeychain.layer;
