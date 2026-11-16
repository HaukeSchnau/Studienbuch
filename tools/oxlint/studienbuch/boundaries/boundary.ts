/** What the files under some paths may not import. Every boundary that matches a file applies. */
export interface Boundary {
  /** Globs over repository paths of the files the boundary applies to. */
  readonly files: ReadonlyArray<string>;
  /**
   * Globs over import specifiers, and over repository paths for relative imports. A relative
   * import never leaves its package, so path globs draw the lines inside one package.
   */
  readonly forbidden: ReadonlyArray<string>;
  /** When set, only these imported names are forbidden, along with namespace and default imports. */
  readonly names?: ReadonlyArray<string>;
  readonly reason: string;
}

export const react = ["react{,/**}", "react-dom{,/**}"];
export const reactNative = ["react-native{,-*}{,/**}", "@react-native{,-*}/**"];
export const expo = ["expo{,-*}{,/**}", "@expo/**"];
export const node = ["node:*{,/**}"];

export const sqlClients = [
  "effect/sql{,/**}",
  "@effect/sql-*{,/**}",
  "drizzle-orm{,/**}",
  "expo-sqlite{,/**}",
  "@electric-sql/**",
  "pg{,/**}",
  "kysely{,/**}",
];

/** The files behind one of `@stu/sync`'s entry points: `client` is `client.ts` and `client/`. */
export const syncFiles = (entry: string) => `packages/sync/src/${entry}{.ts,/**}`;

/**
 * An entry point of `@stu/sync`, by its name and by the paths a relative import inside the package
 * reaches. Boundaries outside packages/sync name the entry only, since a relative import never
 * leaves its package.
 */
export const syncEntry = (entry: string) => [`@stu/sync/${entry}{,/**}`, syncFiles(entry)];
