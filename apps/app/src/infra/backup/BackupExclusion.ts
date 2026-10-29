import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import { requireOptionalNativeModule } from "expo";
import * as SQLite from "expo-sqlite";

// A phone's backups leave out its databases, so a phone restored next to the old one is a new
// device (modules/backup-exclusion). Android's backup rules do it in the build; iOS needs a call
// on the directory, which this makes before a database opens.

export * as BackupExclusion from "./BackupExclusion.ts";

interface Native {
  /** Excludes the directory from backups and says whether iOS reports it excluded. */
  readonly exclude: (path: string) => boolean;
}

const native = Option.fromNullishOr(requireOptionalNativeModule<Native>("BackupExclusion"));

const directory: unknown = SQLite.defaultDatabaseDirectory;

/**
 * Excludes the databases' directory from iCloud backups. `Some` with whether iOS reports it
 * excluded, `None` where the build's backup rules do the work instead.
 */
export const excludeDatabases = Effect.suspend(() =>
  Option.isSome(native) && Predicate.isString(directory)
    ? Effect.try(() => native.value.exclude(directory)).pipe(
        Effect.tapError((error) => Effect.logWarning("The databases stay in backups", error)),
        Effect.orElseSucceed(() => false),
        Effect.asSome,
      )
    : Effect.succeedNone,
);
