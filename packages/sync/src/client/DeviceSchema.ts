/**
 * The device's SQLite schema as Drizzle declarations, derived from the synced tables, so one
 * definition in `packages/core` drives the device's storage, its migrations and its typed queries.
 * Each synced table is a view over two engine tables of JSON rows, because the device never writes
 * one directly: the server fills `base_row`, the outbox fills `pending_row`.
 *
 * ```ts
 * // The schema file drizzle-kit reads. Each entity is a named export, the engine's tables included.
 * export const { sync_meta, sync_space, sync_outbox, sync_rejected_command, base_row, pending_row,
 *   sync_row_view, Homework } = DeviceSchema.make([Homework.Row]);
 * // A typed read:
 * db.select().from(Homework).where(eq(Homework.courseId, courseId)).orderBy(Homework.dueOn)
 * ```
 */
import { sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  primaryKey,
  sqliteTable,
  sqliteView,
  text,
} from "drizzle-orm/sqlite-core";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import type { Sync } from "../definition/Sync.ts";
import { SqliteTx } from "./SqliteTx.ts";

export * as DeviceSchema from "./DeviceSchema.ts";

/**
 * How a field appears as a view column. Scalars come out of `->>` as SQL values, so queries can
 * compare and sort them. Anything else comes out of `->` as JSON text and is parsed, because `->>`
 * would return a string field and an object field holding the same text identically.
 */
export type Kind = "text" | "number" | "boolean" | "json";

export const kindOf = (field: Schema.Constraint): Kind =>
  scalarKind(SchemaAST.toEncoded(Schema.toCodecJson(field).ast)) ?? "json";

const scalarKind = (ast: SchemaAST.AST): Exclude<Kind, "json"> | undefined => {
  if (ast._tag === "String" || ast._tag === "TemplateLiteral") return "text";

  if (ast._tag === "Number") return "number";

  if (ast._tag === "Boolean") return "boolean";

  if (ast._tag === "Literal") {
    const { literal } = ast;

    if (Predicate.isString(literal)) return "text";

    if (Predicate.isNumber(literal)) return "number";

    return Predicate.isBoolean(literal) ? "boolean" : undefined;
  }

  if (ast._tag !== "Union") return undefined;

  const kinds = new Set(
    ast.types
      .filter((member) => member._tag !== "Null" && member._tag !== "Undefined")
      .map(scalarKind),
  );

  const [kind] = kinds;

  return kinds.size === 1 ? kind : undefined;
};

// Drizzle hands a custom column its driver value untyped, and the view's column type is the
// contract for what comes out.
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, typescript/no-unsafe-type-assertion -- see above */
const fromDriver: Record<Kind, (value: unknown) => unknown> = {
  text: (value) => value,
  number: (value) => value,
  boolean: (value) => value === 1,
  // `->` hands out JSON text that SQLite produced from a canonical row.
  json: (value) => JSON.parse(value as string),
};
/* oxlint-enable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, typescript/no-unsafe-type-assertion */

type Encoded<F extends Schema.Constraint> = F["Encoded"];

type Column<F extends Schema.Constraint> = ReturnType<
  ReturnType<
    typeof customType<{
      data: Exclude<Encoded<F>, null | undefined>;
      driverData: unknown;
      notNull: null extends Encoded<F> ? false : undefined extends Encoded<F> ? false : true;
    }>
  >
>;

const column = <F extends Schema.Constraint>(name: string, field: F): Column<F> => {
  const kind = kindOf(field);

  const builder = customType({
    dataType: () => (kind === "number" ? "real" : kind === "boolean" ? "integer" : "text"),
    fromDriver: fromDriver[kind],
  })(name);

  // Drizzle can't type a column built from a runtime schema; `Column<F>` computes it from the field.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion -- see above
  return builder as unknown as Column<F>;
};

const literal = (text: string) => `'${text.replaceAll("'", "''")}'`;

const fieldExpression = (name: string, field: Schema.Constraint) =>
  `data ${kindOf(field) === "json" ? "->" : "->>"} ${literal(SqliteTx.indexPath(name))}`;

/** One synced table as a typed view: `space`, `id` and a column per field. */
export const view = <T extends Sync.Any>(table: T) => {
  const fields = Object.entries(table.fields);

  const columns = {
    space: text("space").notNull(),
    id: text("id").notNull(),
    // Object.fromEntries loses the per-field column types that `column` computed.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    ...(Object.fromEntries(fields.map(([name, field]) => [name, column(name, field)])) as {
      [K in keyof T["fields"]]: Column<T["fields"][K]>;
    }),
  };

  const select = ["space", "id"]
    .concat(fields.map(([name, field]) => `${fieldExpression(name, field)} as "${name}"`))
    .join(", ");

  return sqliteView(table.name, columns).as(
    sql.raw(`select ${select} from sync_row_view where tbl = ${literal(table.name)}`),
  );
};

/**
 * The partial expression indexes for a table's declared indexes. They repeat the view's column
 * expression and table name literally, which is what lets SQLite use them through the views. The id
 * comes last so that `Tx.list`'s order by id needs no sort.
 */
const indexesOn = (rowTable: string, tables: ReadonlyArray<Sync.Any>) =>
  tables.flatMap((table) =>
    table.indexes.map((name) =>
      index(`${rowTable}_${table.name}_${name}`)
        // An index is a key of its table's fields.
        // oxlint-disable-next-line typescript/no-non-null-assertion -- see above
        .on(sql.raw("space"), sql.raw(fieldExpression(name, table.fields[name]!)), sql.raw("id"))
        .where(sql.raw(`tbl = ${literal(table.name)}`)),
    ),
  );

// The engine's own tables start with `sync_`: SQLite compares names without case, so a synced
// table named `Space` or `Outbox` would otherwise collide with them.

/**
 * The device's own state, one row: the client id the server knows it by, the restore epoch of its
 * last pull, the last mutation id it gave a command and the last one it settled.
 */
const sync_meta = sqliteTable("sync_meta", {
  id: integer().primaryKey(),
  client_id: text().notNull(),
  sync_epoch: text(),
  last_mutation_id: integer().notNull(),
  settled_mutation_id: integer().notNull(),
});

/**
 * The spaces the account reads, as the last pull listed them. `version` is the device's cursor,
 * `null` until the space's first patch, and `synced_at` the epoch milliseconds of that pull.
 */
const sync_space = sqliteTable("sync_space", {
  id: text().primaryKey(),
  kind: text().notNull(),
  role: text().notNull(),
  version: integer(),
  key_epoch: integer(),
  synced_at: integer(),
});

/**
 * Commands the server hasn't settled, in plaintext: the mutator's name, version and arguments as
 * canonical JSON, and when the user acted. Only the push seals a `Seal` command.
 */
const sync_outbox = sqliteTable("sync_outbox", {
  mutation_id: integer().primaryKey(),
  name: text().notNull(),
  version: integer().notNull(),
  args: text().notNull(),
  at: integer().notNull(),
  mode: text({ enum: ["Mutate", "Seal"] }).notNull(),
});

/**
 * Commands the server refused, with its reason as JSON, until the user dismisses or redoes them.
 * Keyed by the client id they were sent under, because a new client id numbers again from 1.
 */
const sync_rejected_command = sqliteTable(
  "sync_rejected_command",
  {
    client_id: text().notNull(),
    mutation_id: integer().notNull(),
    name: text().notNull(),
    version: integer().notNull(),
    args: text().notNull(),
    at: integer().notNull(),
    reason: text().notNull(),
  },
  (row) => [primaryKey({ columns: [row.client_id, row.mutation_id] })],
);

export const make = <const Tables extends ReadonlyArray<Sync.Any>>(tables: Tables) => {
  const base_row = sqliteTable(
    "base_row",
    {
      space: text().notNull(),
      tbl: text().notNull(),
      id: text().notNull(),
      version: integer().notNull(),
      data: text().notNull(),
    },
    (row) => [
      primaryKey({ columns: [row.space, row.tbl, row.id] }),
      ...indexesOn("base_row", tables),
    ],
  );

  // `data` is null for a row the outbox deleted.
  const pending_row = sqliteTable(
    "pending_row",
    { space: text().notNull(), tbl: text().notNull(), id: text().notNull(), data: text() },
    (row) => [
      primaryKey({ columns: [row.space, row.tbl, row.id] }),
      ...indexesOn("pending_row", tables),
    ],
  );

  const sync_row_view = sqliteView("sync_row_view", {
    space: text().notNull(),
    tbl: text().notNull(),
    id: text().notNull(),
    data: text().notNull(),
  }).as(
    sql.raw(`select space, tbl, id, data from pending_row where data is not null
      union all
      select space, tbl, id, data from base_row as base
      where not exists (
        select 1 from pending_row as pending
        where pending.space = base.space and pending.tbl = base.tbl and pending.id = base.id
      )`),
  );

  // Object.fromEntries loses each view's type, which `view<T>` computed per table.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion -- see above
  const views = Object.fromEntries(tables.map((table) => [table.name, view(table)])) as unknown as {
    [T in Tables[number] as T["name"]]: ReturnType<typeof view<T>>;
  };

  return {
    sync_meta,
    sync_space,
    sync_outbox,
    sync_rejected_command,
    base_row,
    pending_row,
    sync_row_view,
    ...views,
  };
};
