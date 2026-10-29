/**
 * A table built to find differences between the engines, the steps that exercise `Tx` on it, and
 * the outcome every engine must agree on. The steps are plain JSON, so the hand-written cases can
 * be stored as a fixture that a device replays on expo-sqlite.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Sync } from "../definition/Sync.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Tx } from "../transaction/Tx.ts";
import type { Engines } from "./Engines.ts";

export * as Probe from "./Probe.ts";

export const table = Sync.table("Probe", {
  class: "readable",
  fields: {
    text: Schema.String,
    // The probe stores non-finite numbers on purpose, to compare how the engines keep them.
    // oxlint-disable-next-line effecttsgo/schema-number -- see above
    amount: Schema.Number,
    flag: Schema.Boolean,
    note: Schema.optional(Schema.NullOr(Schema.String)),
    nested: Schema.Json,
    group: Schema.String,
    key: Schema.Json,
  },
  indexes: ["group", "key", "amount"],
});

export type Row = Sync.Row<typeof table>;

/** A row's JSON object, as the table's codec encodes it. */
export const encode = Schema.encodeEffect(table.codec);

export type Index = Sync.IndexOf<typeof table>;

export type Step =
  | { readonly op: "insert" | "put"; readonly id: string; readonly row: Row }
  | {
      readonly op: "patch";
      readonly id: string;
      readonly fields: Partial<Row>;
      /** Fields the patch sets to `undefined`, which JSON can't carry. */
      readonly unset?: ReadonlyArray<keyof Row>;
    }
  | { readonly op: "remove" | "get"; readonly id: string }
  | { readonly op: "list"; readonly where?: { readonly index: Index; readonly equals: unknown } }
  /** The account the transaction runs for. */
  | { readonly op: "actor" }
  /**
   * A row as the server delivered it, written straight into storage: the device's `base_row`, the
   * server's `sync_row`. It may carry fields this table doesn't declare.
   */
  | { readonly op: "seed"; readonly id: string; readonly json: unknown };

/** What one step returned: rows as canonical JSON, or the error's tag and reason. */
/** What a step returns: nothing, a row's canonical JSON, or a list of them. */
export type Ok = null | string | ReadonlyArray<{ readonly id: string; readonly row: string }>;

export type Outcome = { readonly ok: Ok } | { readonly error: string };

export interface Trace {
  readonly outcomes: ReadonlyArray<Outcome>;
  /** The space's stored rows afterwards, normalized: what the engine would hand to a pull. */
  readonly stored: ReadonlyArray<{ readonly id: string; readonly json: string }>;
}

const canonicalRow = (row: Row) =>
  encode(row).pipe(
    Effect.flatMap((json) => Effect.fromResult(CanonicalJson.encode(json))),
    Effect.orDie,
  );

const describe = (error: Tx.Error): Outcome => ({
  error:
    error._tag === "CanonicalJson.Unrepresentable"
      ? `${error._tag}:${error.reason}:${error.path}`
      : error._tag,
});

const step = (engine: Engines.Engine, space: string, step: Step) => {
  const run = (effect: Effect.Effect<Ok, Tx.Error, Tx.Service>) =>
    engine.transaction(effect).pipe(
      Effect.map((ok): Outcome => ({ ok })),
      Effect.catch((error: Tx.Error) => Effect.succeed(describe(error))),
    );

  switch (step.op) {
    case "insert":
    case "put":
      return run(
        Effect.flatMap(Tx.Service, (tx) => tx[step.op](table, space, step.id, step.row)).pipe(
          Effect.as(null),
        ),
      );
    case "patch": {
      const unset = Object.fromEntries((step.unset ?? []).map((field) => [field, undefined]));

      return run(
        Effect.flatMap(Tx.Service, (tx) =>
          tx.patch(table, space, step.id, { ...step.fields, ...unset }),
        ).pipe(Effect.as(null)),
      );
    }

    case "remove":
      return run(
        Effect.flatMap(Tx.Service, (tx) => tx.remove(table, space, step.id)).pipe(Effect.as(null)),
      );
    case "get":
      return run(
        Effect.flatMap(Tx.Service, (tx) => tx.get(table, space, step.id)).pipe(
          Effect.flatMap(
            Option.match({ onNone: () => Effect.succeed(null), onSome: canonicalRow }),
          ),
        ),
      );
    case "list":
      return run(
        Effect.flatMap(Tx.Service, (tx) => tx.list(table, space, step.where)).pipe(
          Effect.flatMap((entries) =>
            Effect.forEach(entries, ({ id, row }) =>
              Effect.map(canonicalRow(row), (text) => ({ id, row: text })),
            ),
          ),
        ),
      );
    case "actor":
      return run(Effect.map(Tx.Service, (tx) => tx.actor));
    case "seed":
      return seed(engine, space, step.id, step.json).pipe(
        Effect.as<Outcome>({ ok: null }),
        Effect.catchTags({
          "CanonicalJson.Unrepresentable": (error) => Effect.succeed(describe(error)),
        }),
      );
  }
};

const seed = Effect.fn("Probe.seed")(
  // A seed writes raw JSON past the codec, including values the encoder must refuse.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- see above
  function* (engine: Engines.Engine, space: string, id: string, json: unknown) {
    const text = yield* Effect.fromResult(CanonicalJson.encode(json));
    const sql = yield* SqlClient.SqlClient;

    return yield* engine.side === "device"
      ? sql`
            insert into base_row (space, tbl, id, version, data)
            values (${space}, ${table.name}, ${id}, 1, ${text})
            on conflict (space, tbl, id) do update set data = excluded.data
          `
      : sql`
            insert into sync_row (space_id, tbl, id, version, data)
            values (${space}, ${table.name}, ${id}, 1, ${text}::jsonb)
            on conflict (space_id, tbl, id) do update set data = excluded.data
          `;
  },
  (effect, engine) => engine.sql(effect),
);

const stored = (engine: Engines.Engine, space: string) =>
  engine
    .sql(
      Effect.flatMap(SqlClient.SqlClient, (sql) =>
        engine.side === "device"
          ? sql<{ readonly id: string; readonly data: string }>`
              select id, data from sync_row_view
              where space = ${space} and tbl = ${table.name} order by id
            `
          : sql<{ readonly id: string; readonly data: string }>`
              select id, data::text as data from sync_row
              where space_id = ${space} and tbl = ${table.name} and data is not null
              order by id
            `,
      ),
    )
    .pipe(
      Effect.flatMap((rows) =>
        Effect.forEach(rows, ({ id, data }) =>
          Effect.map(Effect.fromResult(CanonicalJson.normalize(data)), (json) => ({ id, json })),
        ),
      ),
    );

/** Runs the steps on one engine, each in its own transaction, in a space no other run uses. */
export const run = Effect.fn("Probe.run")(function* (
  engine: Engines.Engine,
  space: string,
  steps: ReadonlyArray<Step>,
) {
  const outcomes = yield* Effect.forEach(steps, (each) => step(engine, space, each));

  return { outcomes, stored: yield* stored(engine, space) } satisfies Trace;
}, Effect.orDie);

let spaces = 0;

/** A space id no earlier run used, so runs share one database per engine. */
export const freshSpace = () => `space-${++spaces}`;
