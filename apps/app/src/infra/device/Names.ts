import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

// What a device's storage is called. Each server origin and device gets its own secrets, and each
// account on them its own database (sync.md, section 7). A name is a hash, so it suits a file, an
// OPFS directory and a keychain entry alike, and the parts can't run into each other.

export * as Names from "./Names.ts";

const digest = (...parts: ReadonlyArray<string>) =>
  bytesToHex(sha256(utf8ToBytes(JSON.stringify(parts)))).slice(0, 32);

/** The namespace of a device's secrets on one server. */
export const secrets = (origin: URL, device: string) => digest("secrets", origin.origin, device);

/** The database of one account on one device and server. */
export const database = (origin: URL, device: string, accountId: string) =>
  `account-${digest("database", origin.origin, device, accountId)}`;
