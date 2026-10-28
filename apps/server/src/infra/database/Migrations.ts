import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

/**
 * One drizzle-kit migration: `<folder>/<name>/migration.sql`, its statements split where drizzle-kit
 * writes `--> statement-breakpoint`. Names start with a timestamp, so name order is creation order.
 */
export interface Migration {
  readonly name: string;
  readonly hash: string;
  readonly statements: ReadonlyArray<string>;
}

export class Unreadable extends Schema.TaggedError<Unreadable>()("Migrations.Unreadable", {
  folder: Schema.String,
  cause: Schema.Defect(),
}) {}

/**
 * An applied migration differs from this release's copy, or is missing from it while older than
 * this release's newest. Applied migrations are immutable, so this needs a person.
 */
export class HistoryMismatch extends Schema.TaggedError<HistoryMismatch>()(
  "Migrations.HistoryMismatch",
  {
    name: Schema.String,
    appliedHash: Schema.String,
    localHash: Schema.NullOr(Schema.String),
  },
) {
  override get message() {
    return this.localHash === null
      ? `Applied migration ${this.name} is missing from this release`
      : `Applied migration ${this.name} differs from this release's copy`;
  }
}

/** The database lacks migrations this release needs; `prepare` applies them. */
export class SchemaBehind extends Schema.TaggedError<SchemaBehind>()("Migrations.SchemaBehind", {
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
      hash: Buffer.from(digest).toString("hex"),
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
 * Fails on the first applied migration that this release edited or deleted. An applied migration
 * newer than every local one is fine: it means an older release runs after a newer one migrated.
 */
const checkHistory = (local: ReadonlyArray<Migration>, applied: ReadonlyArray<Applied>) => {
  const localHashes = new Map(local.map(({ name, hash }) => [name, hash]));
  const head = local.at(-1)?.name;
  for (const { name, hash } of applied) {
    const localHash = localHashes.get(name);
    if (localHash === hash || (localHash === undefined && head !== undefined && name > head))
      continue;
    return Effect.fail(
      new HistoryMismatch({ name, appliedHash: hash, localHash: localHash ?? null }),
    );
  }
  return Effect.void;
};

/** The newest applied migration, and the local migrations not applied yet. */
export const status = Effect.fn("Migrations.status")(function* (local: ReadonlyArray<Migration>) {
  const applied = yield* readApplied;
  const appliedNames = new Set(applied.map(({ name }) => name));
  return {
    head: applied.at(-1)?.name ?? null,
    missing: local.filter(({ name }) => !appliedNames.has(name)).map(({ name }) => name),
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
  yield* checkHistory(local, yield* readApplied);
  yield* requireHead(local);
});

/**
 * Applies every pending migration in one transaction and returns their names. An advisory lock
 * makes concurrent runs wait, so each migration applies once.
 */
export const apply = Effect.fn("Migrations.apply")(function* (local: ReadonlyArray<Migration>) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* sql`SELECT pg_advisory_xact_lock(hashtext(${historyTable}))`;
      yield* sql`CREATE TABLE IF NOT EXISTS ${sql(historyTable)} (
        name text PRIMARY KEY,
        hash text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`;
      const applied = yield* readApplied;
      yield* checkHistory(local, applied);
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

export * as Migrations from "./Migrations.ts";
