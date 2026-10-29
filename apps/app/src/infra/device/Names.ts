import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

// What a device's storage is called. Each server origin and device has its own entries, and each
// account on them its own secrets and database (sync.md, section 7), so two people sharing an iPad
// never read each other's keys. A name is a hash, so it suits a file, an OPFS directory and a
// keychain entry alike, and the parts can't run into each other.

export * as Names from "./Names.ts";

const digest = (...parts: ReadonlyArray<string>) =>
  bytesToHex(sha256(utf8ToBytes(JSON.stringify(parts)))).slice(0, 32);

/** The device's own entries on one server: its sessions and what sign-out has left to delete. */
export const device = (origin: URL, device: string) => digest("device", origin.origin, device);

/** The secrets of one account on one device and server. */
export const secrets = (origin: URL, device: string, accountId: string) =>
  digest("secrets", origin.origin, device, accountId);

/** The database of one account on one device and server. */
export const database = (origin: URL, device: string, accountId: string) =>
  `account-${digest("database", origin.origin, device, accountId)}`;
