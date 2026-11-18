/**
 * The corpus the gate measures (m2-import-corpus.md, sections 5 and 6): one archive in the private
 * corpus repository, by commit and SHA-256. A new archive reaches CI only through a reviewed change
 * of `pin.json`, which is what makes the grammar's trust in a manifest's kept words safe.
 */
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import pinJson from "./pin.json" with { type: "json" };

export * as Pin from "./Pin.ts";

/** Where the pinned corpus is, and what its archive hashes to. */
export const Location = Schema.Struct({
  /** The corpus's id, which names its directory in the cache. */
  id: Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9-]*$/u)),
  /** The private repository, cloned over SSH. */
  repository: Schema.String,
  commit: Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/u)),
  /** The archive's file name in the repository. */
  archive: Schema.String.check(Schema.isPattern(/^[a-z0-9][a-z0-9.-]*\.tar\.zst\.age$/u)),
  sha256: Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u)),
});

export type Location = typeof Location.Type;

/** The fetch in the cache is of another archive than the pin's, or there is none. */
export class NotFetched extends Schema.TaggedError<NotFetched, { readonly brand: unique symbol }>()(
  "Pin.NotFetched",
  { id: Schema.String },
) {
  override get message() {
    return `the cache doesn't hold the pinned ${this.id}: run vp run corpus:fetch --pinned`;
  }
}

export const pinned = Schema.decodeEffect(Location)(pinJson);

const home = Config.String("HOME");

/** Where fetched corpora live, outside every worktree. */
export const cacheRoot = Config.String("XDG_CACHE_HOME").pipe(
  Config.orElse(() => Config.map(home, (dir) => `${dir}/.cache`)),
  Config.map((dir) => `${dir}/studienbuch/import-corpus`),
);

/**
 * A fetched corpus's directory in the cache, named by its archive's SHA-256. A fetch writes it
 * once, complete, and never replaces it, so an evaluation that reads it can't see another fetch.
 */
export const directory = (root: string, sha256: string) => `${root}/${sha256}`;

/** The pinned corpus's directory in the cache, when a fetch of the pinned archive put it there. */
export const cached = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pin = yield* pinned;
  const fetched = directory(yield* cacheRoot, pin.sha256);

  return (yield* fs.exists(fetched)) ? fetched : yield* new NotFetched({ id: pin.id });
});
