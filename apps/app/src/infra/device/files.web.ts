import * as Effect from "effect/Effect";

// A browser has no backups to leave and no keychain that outlives the site's data.

export const excludeDatabases = Effect.succeedNone;

export const firstStartSinceInstall = (): boolean => false;
