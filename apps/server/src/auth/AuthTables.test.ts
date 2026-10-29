import { assert, describe, it } from "@effect/vitest";
import { getAuthTables } from "better-auth/db";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as Redacted from "effect/Redacted";
import { Auth } from "./Auth.ts";
import { AuthTables } from "./AuthTables.ts";

interface Column {
  readonly type: string;
  readonly notNull: boolean;
  readonly unique: boolean;
  readonly references: string | null;
}

interface Table {
  readonly columns: Record<string, Column>;
  readonly indexed: ReadonlyArray<string>;
}

const options = Auth.options(
  {
    publicUrl: "http://localhost:3000",
    secret: Redacted.make("secret"),
    rpId: "localhost",
    nativeApps: { ios: [], android: [] },
    signUp: true,
  },
  { sendCode: () => Promise.resolve(), sessionDeleted: () => {}, log: () => {} },
);

// The Postgres types Better Auth's own migrations create for each field type.
const sqlType = (field: { readonly type: unknown; readonly bigint?: boolean | undefined }) => {
  switch (field.type) {
    case "string":
      return "text";
    case "boolean":
      return "boolean";
    case "number":
      return field.bigint === true ? "bigint" : "integer";
    case "date":
      return "timestamp with time zone";
    default:
      return `unsupported ${String(field.type)}`;
  }
};

const expected = (): Record<string, Table> => {
  const tables = getAuthTables(options);
  const tableName = (model: string) => tables[model]?.modelName ?? model;

  return Object.fromEntries(
    Object.values(tables).map((table): [string, Table] => {
      const fields = Object.entries(table.fields).map(([key, field]) => ({
        name: field.fieldName ?? key,
        field,
      }));

      return [
        table.modelName,
        {
          columns: Object.fromEntries([
            ["id", { type: "text", notNull: true, unique: false, references: null }],
            ...fields.map(({ name, field }): [string, Column] => [
              name,
              {
                type: sqlType(field),
                notNull: field.required === true,
                unique: field.unique === true,
                references:
                  field.references === undefined
                    ? null
                    : `${tableName(field.references.model)}.${field.references.field} ${field.references.onDelete ?? "cascade"}`,
              },
            ]),
          ]),
          indexed: fields
            .filter(({ field }) => field.index === true)
            .map(({ name }) => name)
            .sort(),
        },
      ];
    }),
  );
};

const declared = (): Record<string, Table> =>
  Object.fromEntries(
    Object.values(AuthTables)
      .filter((value) => is(value, PgTable))
      .map((table): [string, Table] => {
        const config = getTableConfig(table);

        const references = new Map(
          config.foreignKeys.map((key) => {
            const { columns, foreignTable, foreignColumns } = key.reference();

            return [
              columns[0]?.name,
              `${getTableConfig(foreignTable).name}.${foreignColumns[0]?.name} ${key.onDelete}`,
            ];
          }),
        );

        return [
          config.name,
          {
            columns: Object.fromEntries(
              config.columns.map((column): [string, Column] => [
                column.name,
                {
                  type: column.getSQLType(),
                  notNull: column.notNull,
                  unique: column.isUnique,
                  references: references.get(column.name) ?? null,
                },
              ]),
            ),
            indexed: config.indexes
              .flatMap((index) => index.config.columns)
              .map((column) =>
                column !== undefined && "name" in column ? (column.name ?? "?") : "?",
              )
              .sort(),
          },
        ];
      }),
  );

describe("AuthTables", () => {
  it("declares the tables Better Auth writes, column for column", () => {
    assert.deepStrictEqual(declared(), expected());
  });
});
