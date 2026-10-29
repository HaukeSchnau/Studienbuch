/**
 * The transaction a mutator reads and writes rows through, on SQLite on the device and on Postgres
 * on the server. Everything that decides a row's JSON happens here, in shared code: encoding, the
 * patch merge, existence checks. An engine only stores and returns canonical JSON text through a
 * {@link Store}, which keeps the two small enough to test against each other, operation by op.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type * as SqlError from "effect/sql/SqlError";
import type { Sync } from "../definition/Sync.ts";
import { Ids } from "../protocol/Ids.ts";
import { CanonicalJson } from "./CanonicalJson.ts";

export * as Tx from "./Tx.ts";

export class RowExists extends Schema.TaggedError<RowExists, { readonly brand: unique symbol }>()(
  "Tx.RowExists",
  {
    table: Schema.String,
    space: Schema.String,
    id: Schema.String,
  },
) {}

export class RowMissing extends Schema.TaggedError<RowMissing, { readonly brand: unique symbol }>()(
  "Tx.RowMissing",
  {
    table: Schema.String,
    space: Schema.String,
    id: Schema.String,
  },
) {}

/** A value that doesn't fit its table's schema, on the way in or out of storage. */
export class InvalidRow extends Schema.TaggedError<InvalidRow, { readonly brand: unique symbol }>()(
  "Tx.InvalidRow",
  {
    table: Schema.String,
    space: Schema.String,
    id: Schema.String,
    message: Schema.String,
  },
) {}

/** A space or row id outside `Ids.Id`, which every client's pull would refuse. */
export class InvalidId extends Schema.TaggedError<InvalidId, { readonly brand: unique symbol }>()(
  "Tx.InvalidId",
  {
    table: Schema.String,
    space: Schema.String,
    id: Schema.String,
  },
) {}

/**
 * Why a `Tx` call failed. Every one but `SqlError` can be a command's refusal reason, so they are
 * schemas. A `SqlError` means the database failed, and the command is retried.
 */
export type Error = Refused | SqlError.SqlError;

export const Refused = Schema.Union([
  RowExists,
  RowMissing,
  InvalidRow,
  InvalidId,
  CanonicalJson.Unrepresentable,
]);

export type Refused = typeof Refused.Type;

export interface Entry<A> {
  readonly id: string;
  readonly row: A;
}

/** An equality filter on a declared index. */
export interface Where<T extends Sync.Any> {
  readonly index: Sync.IndexOf<T>;
  readonly equals: unknown;
}

/** Where a mutator runs: on a device, or on the server for a readable table's command. */
export type Location = "client" | "server";

export interface Interface {
  /**
   * The account the command runs for: the signed-in account on a device, the connection's account
   * on the server.
   */
  readonly actor: string;
  /**
   * Where the mutator runs. Its reads and writes must not depend on it, or the device would show
   * rows the server never stores.
   */
  readonly location: Location;
  readonly get: <T extends Sync.Any>(
    table: T,
    space: string,
    id: string,
  ) => Effect.Effect<Option.Option<Sync.Row<T>>, Error>;
  /**
   * Live rows ordered by id in UTF-8 byte order, optionally filtered by one declared index. A row
   * whose field is absent or `null` never matches.
   */
  readonly list: <T extends Sync.Any>(
    table: T,
    space: string,
    where?: Where<T>,
  ) => Effect.Effect<ReadonlyArray<Entry<Sync.Row<T>>>, Error>;
  /** Creates a row, and fails if it exists. */
  readonly insert: <T extends Sync.Any>(
    table: T,
    space: string,
    id: string,
    row: Sync.Row<T>,
  ) => Effect.Effect<void, Error>;
  /** Creates or replaces a row. */
  readonly put: <T extends Sync.Any>(
    table: T,
    space: string,
    id: string,
    row: Sync.Row<T>,
  ) => Effect.Effect<void, Error>;
  /**
   * Replaces the given top-level fields of an existing row. A field given as `undefined` becomes
   * absent. Fields the table doesn't declare, written by a newer app version, are kept.
   */
  readonly patch: <T extends Sync.Any>(
    table: T,
    space: string,
    id: string,
    fields: Partial<Sync.Row<T>>,
  ) => Effect.Effect<void, Error>;
  /** Deletes a row. Deleting a missing row succeeds, so a replayed command is harmless. */
  readonly remove: (table: Sync.Any, space: string, id: string) => Effect.Effect<void, Error>;
}

export class Service extends Context.Service<Service, Interface>()("@stu/sync/Tx") {}

/** An index filter as the engines see it: the field and its encoded value, never `null`. */
export interface StoreFilter {
  readonly field: string;
  readonly value: unknown;
  /** The value as canonical JSON. */
  readonly json: string;
}

/** Who a transaction runs for, and the tables it may write. */
export interface Runner {
  readonly actor: string;
  /** A mutator's `writes`, or the table `SyncWriter` reconciles. A write elsewhere is a defect. */
  readonly writes: ReadonlyArray<Sync.Any>;
}

/** What an engine implements for one transaction. Rows go in and out as canonical JSON text. */
export interface Store extends Runner {
  /**
   * On the server, touching an encrypted table is a defect: the server holds only envelopes and
   * ciphertext of those rows, and never runs their mutators.
   */
  readonly location: Location;
  readonly read: (
    space: string,
    table: string,
    id: string,
  ) => Effect.Effect<Option.Option<string>, SqlError.SqlError>;
  readonly list: (
    space: string,
    table: string,
    filter: StoreFilter | undefined,
  ) => Effect.Effect<
    ReadonlyArray<{ readonly id: string; readonly data: string }>,
    SqlError.SqlError
  >;
  /** Writes a row's canonical JSON, or deletes the row when `data` is `null`. */
  readonly write: (
    space: string,
    table: string,
    id: string,
    data: string | null,
  ) => Effect.Effect<void, SqlError.SqlError>;
}

const parseJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown));

const isId = Schema.is(Ids.Id);

export const make = (store: Store): Interface => {
  const writable = new Set(store.writes);

  /** Dies before the server reads or writes a table whose rows it must never hold in plaintext. */
  const readable = (table: Sync.Any) =>
    store.location === "server" && table.class === "encrypted"
      ? Effect.die(`The server's Tx touched the encrypted table ${table.name}`)
      : Effect.void;

  /** The checks before any write: a declared table, then ids every client can store. */
  const writing = (table: Sync.Any, space: string, id: string) =>
    Effect.andThen(
      readable(table),
      writable.has(table)
        ? isId(space) && isId(id)
          ? Effect.void
          : Effect.fail(new InvalidId({ table: table.name, space, id }))
        : Effect.die(`A write to ${table.name}, which the command doesn't declare`),
    );

  const invalid = (table: Sync.Any, space: string, id: string) => (error: Schema.SchemaError) =>
    new InvalidRow({ table: table.name, space, id, message: error.message });

  const parse = (table: Sync.Any, space: string, id: string, text: string) =>
    parseJson(text).pipe(Effect.mapError(invalid(table, space, id)));

  // `json` is a stored row after JSON parsing, and the codec is what parses it into a row. The codec
  // is generic over every table, so its decoded side is the table's row by construction.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- see above
  const decode = <T extends Sync.Any>(table: T, space: string, id: string, json: unknown) =>
    Schema.decodeUnknownEffect(table.codec)(json).pipe(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
      Effect.map((row) => row as Sync.Row<T>),
      Effect.mapError(invalid(table, space, id)),
    );

  const encode = <T extends Sync.Any>(table: T, space: string, id: string, row: Sync.Row<T>) =>
    Schema.encodeEffect(table.codec)(row).pipe(Effect.mapError(invalid(table, space, id)));

  const read = <T extends Sync.Any>(table: T, space: string, id: string, text: string) =>
    Effect.flatMap(parse(table, space, id, text), (json) => decode(table, space, id, json));

  const write = <T extends Sync.Any>(table: T, space: string, id: string, row: Sync.Row<T>) =>
    encode(table, space, id, row).pipe(
      Effect.flatMap((json) => Effect.fromResult(CanonicalJson.encode(json))),
      Effect.flatMap((text) => store.write(space, table.name, id, text)),
    );

  // Mutators call these once per row, on every replay of the outbox, so they carry no span.
  return {
    actor: store.actor,
    location: store.location,

    get: Effect.fnUntraced(function* <T extends Sync.Any>(table: T, space: string, id: string) {
      yield* readable(table);
      const stored = yield* store.read(space, table.name, id);

      return Option.isNone(stored)
        ? Option.none()
        : Option.some(yield* read(table, space, id, stored.value));
    }),

    list: Effect.fnUntraced(function* <T extends Sync.Any>(
      table: T,
      space: string,
      where?: Where<T>,
    ) {
      yield* readable(table);
      const filter = where === undefined ? undefined : yield* indexFilter(table, where);

      if (filter?.value === null) return [];
      const rows = yield* store.list(space, table.name, filter);

      return yield* Effect.forEach(rows, ({ id, data }) =>
        Effect.map(read(table, space, id, data), (row) => ({ id, row })),
      );
    }),

    insert: Effect.fnUntraced(function* <T extends Sync.Any>(
      table: T,
      space: string,
      id: string,
      row: Sync.Row<T>,
    ) {
      yield* writing(table, space, id);
      const stored = yield* store.read(space, table.name, id);

      if (Option.isSome(stored)) return yield* new RowExists({ table: table.name, space, id });
      yield* write(table, space, id, row);
    }),

    put: (table, space, id, row) =>
      Effect.andThen(writing(table, space, id), write(table, space, id, row)),

    patch: Effect.fnUntraced(function* <T extends Sync.Any>(
      table: T,
      space: string,
      id: string,
      fields: Partial<Sync.Row<T>>,
    ) {
      yield* writing(table, space, id);
      const stored = yield* store.read(space, table.name, id);

      if (Option.isNone(stored)) return yield* new RowMissing({ table: table.name, space, id });
      const json = yield* parse(table, space, id, stored.value);
      const current = yield* decode(table, space, id, json);
      const merged = yield* encode(table, space, id, mergeFields(current, fields));

      const text = yield* Effect.fromResult(
        CanonicalJson.encode(keepUndeclaredFields(table, json, merged)),
      );

      yield* store.write(space, table.name, id, text);
    }),

    remove: Effect.fnUntraced(function* (table: Sync.Any, space: string, id: string) {
      yield* writing(table, space, id);
      const stored = yield* store.read(space, table.name, id);

      if (Option.isSome(stored)) yield* store.write(space, table.name, id, null);
    }),
  };
};

const indexFilter = Effect.fnUntraced(function* <T extends Sync.Any>(table: T, where: Where<T>) {
  const encoded = yield* Schema.encodeUnknownEffect(table.indexCodec(where.index))({
    [where.index]: where.equals,
  }).pipe(
    Effect.mapError(
      (error) => new InvalidRow({ table: table.name, space: "", id: "", message: error.message }),
    ),
  );

  // The index codec encodes a one-field object, so its output is that object.
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type, typescript/no-unsafe-type-assertion -- see above
  const value = (encoded as Readonly<Record<string, unknown>>)[where.index] ?? null;
  const json = yield* Effect.fromResult(CanonicalJson.encode(value));

  return { field: where.index, value, json } satisfies StoreFilter;
});

// Both helpers handle a row as the plain JSON object it is in storage, and the table's codec parses
// what they return before anything reads it.
/* oxlint-disable anti-slop/no-known-value-widening, anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, typescript/no-unsafe-type-assertion -- see above */

// Spread, not assignment, so a field named `__proto__` stays a field.
const mergeFields = <A extends object>(current: A, fields: Partial<A>): A => {
  const merged: Record<string, unknown> = { ...current, ...fields };

  for (const key of Object.keys(fields)) {
    if (merged[key] === undefined) delete merged[key];
  }

  return merged as A;
};

const keepUndeclaredFields = (table: Sync.Any, stored: unknown, encoded: unknown): unknown => {
  const undeclared = Object.entries(stored as Readonly<Record<string, unknown>>).filter(
    ([key]) => !Object.hasOwn(table.fields, key),
  );

  return { ...Object.fromEntries(undeclared), ...(encoded as Readonly<Record<string, unknown>>) };
};
/* oxlint-enable anti-slop/no-known-value-widening, anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, typescript/no-unsafe-type-assertion */
