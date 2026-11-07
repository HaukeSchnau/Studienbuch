import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import { requireOptionalNativeModule } from "expo";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

// The phone's files, through modules/device-files on iOS. Android needs no calls: its backup rules
// leave the databases out at build time, and its keystore goes with the app. `files.web.ts`
// is the browser's, which has neither.

interface Native {
  readonly excludeFromBackup: (path: string) => boolean;
  readonly clearKeychainAfterInstall: (services: ReadonlyArray<string>) => number;
}

const native = Option.fromNullishOr(requireOptionalNativeModule<Native>("DeviceFiles"));

const directory: unknown = SQLite.defaultDatabaseDirectory;

/**
 * Excludes the databases' directory from iCloud backups, so a phone restored next to the old one
 * is a new device. `Some` with whether iOS reports it excluded (false when the binary lacks the
 * module), `None` on Android, whose build rules do it.
 */
export const excludeDatabases = Effect.suspend(() => {
  if (Platform.OS !== "ios") return Effect.succeedNone;

  return Option.isSome(native) && Predicate.isString(directory)
    ? Effect.try(() => native.value.excludeFromBackup(directory)).pipe(
        Effect.tapError((error) => Effect.logWarning("The databases stay in backups", error)),
        Effect.orElseSucceed(() => false),
        Effect.asSome,
      )
    : Effect.succeedSome(false);
});

/**
 * On the first start of an iOS install, deletes every keychain entry of the given services, which
 * iOS kept from an earlier install of the app. Returns how many it deleted: 0 on every later
 * start, on Android, whose keystore goes with the app, and in a binary without the module. Throws
 * when iOS refuses, so the next call tries again.
 */
export const clearKeychainAfterInstall = (services: ReadonlyArray<string>): number =>
  Platform.OS === "ios" && Option.isSome(native)
    ? native.value.clearKeychainAfterInstall(services)
    : 0;
