/**
 * The real `Tx` over rows in memory, for core's tests. `Tx.make` decides every row's JSON, and the
 * conformance suite in packages/sync shows that SQLite and Postgres store and list rows alike, so
 * a mutator does here what it does on either engine. Core may not import a SQL client.
 */
import { CanonicalJson, Tx } from "@stu/sync";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

export * as MemoryTx from "./MemoryTx.ts";

interface Stored {
  readonly space: string;
  readonly table: string;
  readonly id: string;
  /** Canonical JSON, as both engines store it. */
  readonly data: string;
}

/** Who a transaction runs for, and where. */
export interface Runner extends Tx.Runner {
  readonly location: Tx.Location;
}

const parseJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Json));

const parseObject = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Record(Schema.String, Schema.Json)),
);

const keyOf = (space: string, table: string, id: string) => JSON.stringify([space, table, id]);

// The engines list rows in UTF-8 byte order, which is code point order. JavaScript compares UTF-16
// code units, which sorts characters above U+FFFF before U+E000 to U+FFFF.
const byCodePoint = (left: Stored, right: Stored) => {
  const [a, b] = [Array.from(left.id), Array.from(right.id)];

  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = (a[index]?.codePointAt(0) ?? 0) - (b[index]?.codePointAt(0) ?? 0);

    if (difference !== 0) return difference;
  }

  return a.length - b.length;
};

// Postgres compares the field's JSON, and SQLite its canonical text, which is the same thing.
const matches = (row: Stored, filter: Tx.StoreFilter) =>
  Option.match(parseObject(row.data), {
    onNone: () => false,
    onSome: (json) => {
      const value = json[filter.field];

      return (
        value !== undefined &&
        value !== null &&
        Result.getOrUndefined(CanonicalJson.encode(value)) === filter.json
      );
    },
  });

export const make = () => {
  const rows = new Map<string, Stored>();

  const store = (runner: Runner, draft: Map<string, Stored>): Tx.Store => ({
    ...runner,
    read: (space, table, id) =>
      Effect.sync(() =>
        Option.map(Option.fromUndefinedOr(draft.get(keyOf(space, table, id))), (row) => row.data),
      ),
    list: (space, table, filter) =>
      Effect.sync(() =>
        [...draft.values()]
          .filter((row) => row.space === space && row.table === table)
          .filter((row) => filter === undefined || matches(row, filter))
          .sort(byCodePoint)
          .map(({ id, data }) => ({ id, data })),
      ),
    write: (space, table, id, data) =>
      Effect.sync(() => {
        const key = keyOf(space, table, id);

        if (data === null) draft.delete(key);
        else draft.set(key, { space, table, id, data });
      }),
  });

  return {
    /** Runs `effect` as one transaction. It keeps nothing it wrote when it fails. */
    transaction: <A, E>(runner: Runner, effect: Effect.Effect<A, E, Tx.Service>) =>
      Effect.suspend(() => {
        const draft = new Map(rows);

        return Effect.provideService(effect, Tx.Service, Tx.make(store(runner, draft))).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              rows.clear();

              for (const [key, row] of draft) rows.set(key, row);
            }),
          ),
        );
      }),

    /** A row's JSON as an engine would hand it to a pull, or none when it doesn't exist. */
    stored: (space: string, table: string, id: string) =>
      Option.flatMap(Option.fromUndefinedOr(rows.get(keyOf(space, table, id))), (row) =>
        parseJson(row.data),
      ),

    /** Stores JSON past the table's codec, such as a row a newer app wrote. */
    seed: (space: string, table: string, id: string, json: Schema.Json) =>
      Effect.map(Effect.fromResult(CanonicalJson.encode(json)), (data) => {
        rows.set(keyOf(space, table, id), { space, table, id, data });
      }),
  };
};

export type Database = ReturnType<typeof make>;
