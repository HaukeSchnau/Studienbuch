import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Deployment } from "../config/Deployment.ts";

/**
 * One drizzle-kit migration: `<folder>/<name>/migration.sql`, its statements split where drizzle-kit
 * writes `--> statement-breakpoint`. Names start with a timestamp, so name order is creation order.
 */
export interface Migration {
  readonly name: string;
  readonly hash: string;
  readonly statements: ReadonlyArray<string>;
}

export class Unreadable extends Schema.TaggedError<Unreadable, { readonly brand: unique symbol }>()(
  "Migrations.Unreadable",
  {
    folder: Schema.String,
    cause: Schema.Defect(),
  },
) {}

/**
 * An applied migration differs from this release's copy, or is missing from it while older than
 * this release's newest. Applied migrations are immutable, so this needs a person, except on a
 * preview (`prepare`).
 */
export class HistoryMismatch extends Schema.TaggedError<
  HistoryMismatch,
  { readonly brand: unique symbol }
>()("Migrations.HistoryMismatch", {
  migration: Schema.String,
  appliedHash: Schema.String,
  localHash: Schema.NullOr(Schema.String),
}) {
  override get message() {
    return this.localHash === null
      ? `Applied migration ${this.migration} is missing from this release`
      : `Applied migration ${this.migration} differs from this release's copy`;
  }
}

/** The database lacks migrations this release needs; `prepare` applies them. */
export class SchemaBehind extends Schema.TaggedError<
  SchemaBehind,
  { readonly brand: unique symbol }
>()("Migrations.SchemaBehind", {
  missing: Schema.Array(Schema.String),
}) {
  override get message() {
    return `The database lacks migration ${this.missing.join(", ")}. Run prepare first.`;
  }
}

const historyTable = "studienbuch_migration";

/** Reads every migration below `folder`, sorted by name. */
export const read = Effect.fn("Migrations.read")(function* (folder: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;
  const encoder = new TextEncoder();
  const unreadable = (cause: unknown) => new Unreadable({ folder, cause });

  const names = (yield* fs.readDirectory(folder).pipe(Effect.mapError(unreadable))).sort();
  const migrations: Array<Migration> = [];

  for (const name of names) {
    const file = path.join(folder, name, "migration.sql");

    if (!(yield* fs.exists(file).pipe(Effect.mapError(unreadable)))) continue;
    const sql = yield* fs.readFileString(file).pipe(Effect.mapError(unreadable));

    const digest = yield* crypto
      .digest("SHA-256", encoder.encode(sql))
      .pipe(Effect.mapError(unreadable));

    migrations.push({
      name,
      hash: Hex.encode(digest),
      statements: sql
        .split("--> statement-breakpoint")
        .filter((statement) => statement.trim() !== ""),
    });
  }

  return migrations;
});

/** The migrations this release ships. */
export class Release extends Context.Service<Release, ReadonlyArray<Migration>>()(
  "Migrations.Release",
) {}

export const layerRelease = (folder: string) => Layer.effect(Release)(read(folder));

interface Applied {
  readonly name: string;
  readonly hash: string;
}

const readApplied = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const [history] = yield* sql<{ readonly exists: boolean }>`
    SELECT to_regclass(${historyTable}) IS NOT NULL AS exists`;

  if (!history?.exists) return [];

  return yield* sql<Applied>`SELECT name, hash FROM ${sql(historyTable)} ORDER BY name`;
});

/**
 * The first applied migration that this release edited or deleted. An applied migration newer than
 * every local one is fine: it means an older release runs after a newer one migrated.
 */
const mismatchOf = (local: ReadonlyArray<Migration>, applied: ReadonlyArray<Applied>) => {
  const localHashes = new Map(local.map(({ name, hash }) => [name, hash]));
  const head = local.at(-1)?.name;

  for (const { name, hash } of applied) {
    const localHash = localHashes.get(name);

    if (localHash === hash || (localHash === undefined && head !== undefined && name > head))
      continue;

    return new HistoryMismatch({
      migration: name,
      appliedHash: hash,
      localHash: localHash ?? null,
    });
  }

  return undefined;
};

/** The newest applied migration, and the local migrations not applied yet. */
export const status = Effect.fn("Migrations.status")(function* (local: ReadonlyArray<Migration>) {
  const applied = yield* readApplied;
  const appliedNames = new Set(applied.map(({ name }) => name));

  return {
    head: applied.at(-1)?.name ?? null,
    missing: local.flatMap(({ name }) => (appliedNames.has(name) ? [] : [name])),
  };
});

/** Fails unless every local migration is applied. A database ahead of `local` passes. */
export const requireHead = Effect.fn("Migrations.requireHead")(function* (
  local: ReadonlyArray<Migration>,
) {
  const { missing } = yield* status(local);

  if (missing.length > 0) return yield* new SchemaBehind({ missing });
});

/** `requireHead`, and no applied migration was edited or deleted. */
export const verify = Effect.fn("Migrations.verify")(function* (local: ReadonlyArray<Migration>) {
  const mismatch = mismatchOf(local, yield* readApplied);

  if (mismatch !== undefined) return yield* mismatch;
  yield* requireHead(local);
});

/**
 * Applies every pending migration in one transaction and returns their names. An advisory lock
 * makes concurrent runs wait, so each migration applies once. With `startOver`, a history this
 * release can't continue doesn't fail: everything the database's role owns is dropped first.
 */
export const apply = Effect.fn("Migrations.apply")(function* (
  local: ReadonlyArray<Migration>,
  options?: { readonly startOver: boolean },
) {
  const sql = yield* SqlClient.SqlClient;

  const createHistory = sql`CREATE TABLE IF NOT EXISTS ${sql(historyTable)} (
    name text PRIMARY KEY,
    hash text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext(${historyTable}))`;
      yield* createHistory;
      let applied = yield* readApplied;
      const mismatch = mismatchOf(local, applied);

      if (mismatch !== undefined) {
        if (options?.startOver !== true) return yield* mismatch;

        yield* Effect.logWarning(
          "The migration history doesn't match, so the database starts over",
        ).pipe(Effect.annotateLogs({ migration: mismatch.migration }));
        // The host creates the role and its database, so the role may drop what it created in it
        // but not the database itself.
        yield* sql`DROP OWNED BY CURRENT_USER`;
        yield* createHistory;
        applied = [];
      }

      const appliedNames = new Set(applied.map(({ name }) => name));
      const pending = local.filter(({ name }) => !appliedNames.has(name));

      for (const migration of pending) {
        for (const statement of migration.statements) yield* sql.unsafe(statement);
        yield* sql`INSERT INTO ${sql(historyTable)} ${sql.insert({ name: migration.name, hash: migration.hash })}`;
      }

      return pending.map(({ name }) => name);
    }),
  );
});

/**
 * `apply` as `prepare` runs it. A preview holds only the demo school, which `prepare` seeds again,
 * so there a history the release can't continue starts over, such as a pull request's migration
 * that was renamed after its preview applied it. Anywhere else it needs a person.
 */
export const prepare = Effect.fn("Migrations.prepare")(function* (local: ReadonlyArray<Migration>) {
  const { environment } = yield* Deployment.Current;

  return yield* apply(local, { startOver: environment === "preview" });
});

export * as Migrations from "./Migrations.ts";
