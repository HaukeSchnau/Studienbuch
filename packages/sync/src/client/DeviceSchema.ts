/**
 * The device's SQLite schema as Drizzle declarations, derived from the synced tables, so one
 * definition in `packages/core` drives the device's storage, its migrations (drizzle-kit reads
 * this) and its typed queries.
 *
 * The device stores rows as JSON in two engine tables, and each synced table is a view over them.
 * A Drizzle view, not a table, because the device never writes a synced table directly: the server
 * fills `base_row`, the outbox fills `pending_row`.
 *
 * ```ts
 * // The schema file drizzle-kit reads. Each entity is a named export.
 * export const { base_row, pending_row, sync_row_view, Homework } = DeviceSchema.make([
 *   Homework.Row,
 * ]);
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
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { Sync } from "../definition/Sync.ts";
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
  switch (ast._tag) {
    case "String":
    case "TemplateLiteral":
      return "text";
    case "Number":
      return "number";
    case "Boolean":
      return "boolean";
    case "Literal":
      return typeof ast.literal === "string"
        ? "text"
        : typeof ast.literal === "number"
          ? "number"
          : typeof ast.literal === "boolean"
            ? "boolean"
            : undefined;
    case "Union": {
      const kinds = new Set(
        ast.types
          .filter((member) => member._tag !== "Null" && member._tag !== "Undefined")
          .map(scalarKind),
      );
      const [kind] = kinds;
      return kinds.size === 1 ? kind : undefined;
    }
    default:
      return undefined;
  }
};

const fromDriver: Record<Kind, (value: unknown) => unknown> = {
  text: (value) => value,
  number: (value) => value,
  boolean: (value) => value === 1,
  // `->` hands out JSON text that SQLite produced from a canonical row.
  json: (value) => JSON.parse(value as string),
};

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
        .on(sql.raw("space"), sql.raw(fieldExpression(name, table.fields[name]!)), sql.raw("id"))
        .where(sql.raw(`tbl = ${literal(table.name)}`)),
    ),
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
  const views = Object.fromEntries(tables.map((table) => [table.name, view(table)])) as unknown as {
    [T in Tables[number] as T["name"]]: ReturnType<typeof view<T>>;
  };
  return { base_row, pending_row, sync_row_view, ...views };
};
