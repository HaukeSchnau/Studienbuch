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
  readonly firstStartSinceInstall: () => boolean;
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
 * Whether the app starts for the first time since it was installed, which only matters on iOS,
 * where the keychain outlives the app. Each install answers true once.
 */
export const firstStartSinceInstall = (): boolean => {
  if (Platform.OS !== "ios" || Option.isNone(native)) return false;

  try {
    return native.value.firstStartSinceInstall();
  } catch {
    return false;
  }
};
