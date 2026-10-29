/**
 * The full shape of a definition, for core's test. Rows on phones and on the server were written
 * with these types, so a field never changes its type, disappears or becomes required, and a
 * mutator's arguments change only with its version. The contract's hash sees names only.
 *
 * ```ts
 * // packages/core: one committed snapshot per schema version
 * const current = Evolution.snapshot(schema)
 * expect(committed.flatMap((previous) => Evolution.breakingChanges(previous, current))).toEqual([])
 * expect(current).toEqual(committedFor(schema.contract.schema)) // a change needs a new version
 * ```
 */
import type * as JsonSchema from "effect/JsonSchema";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import type { Sync } from "./Sync.ts";

export * as Evolution from "./Evolution.ts";

export interface TableSnapshot {
  readonly class: Sync.Class;
  /** Each field's JSON Schema document, with the definitions it refers to. */
  readonly fields: { readonly [field: string]: Document };
  readonly required: ReadonlyArray<string>;
}

export interface Snapshot {
  readonly schema: number;
  readonly tables: { readonly [table: string]: TableSnapshot };
  /** The JSON Schema document of each mutator's arguments, by `name@version`. */
  readonly mutators: { readonly [mutator: string]: Document };
}

export type Document = JsonSchema.Document<"draft-2020-12">;

export const snapshot = (definition: Sync.Definition): Snapshot => ({
  schema: definition.contract.schema,
  tables: Object.fromEntries(
    definition.tables.map((table) => {
      const fields = Object.entries(table.fields);
      const { required } = Schema.toJsonSchemaDocument(Schema.Struct(table.fields)).schema;

      return [
        table.name,
        {
          class: table.class,
          fields: Object.fromEntries(
            fields.map(([field, schema]) => [
              field,
              Schema.toJsonSchemaDocument(Schema.Struct({ [field]: schema })),
            ]),
          ),
          required: Array.isArray(required) ? required.filter(Predicate.isString).sort() : [],
        },
      ];
    }),
  ),
  mutators: Object.fromEntries(
    definition.mutators.map((mutator) => [
      `${mutator.name}@${mutator.version}`,
      Schema.toJsonSchemaDocument(mutator.args),
    ]),
  ),
});

const same = (left: Document, right: Document) => {
  const text = (document: Document) =>
    Result.getOrElse(CanonicalJson.encode(document), () => JSON.stringify(document));

  return text(left) === text(right);
};

/**
 * What `current` breaks against an earlier snapshot. A table's breaking change needs a new
 * table name, a mutator's a new version.
 */
export const breakingChanges = (previous: Snapshot, current: Snapshot): ReadonlyArray<string> => [
  ...Object.entries(previous.tables).flatMap(([name, before]) => {
    const after = current.tables[name];

    if (after === undefined) return [`table ${name} was removed`];

    return [
      ...(after.class === before.class ? [] : [`table ${name} changed its class`]),
      ...Object.entries(before.fields).flatMap(([field, schema]) => {
        const now = after.fields[field];

        if (now === undefined) return [`${name}.${field} was removed`];

        return same(schema, now) ? [] : [`${name}.${field} changed its type`];
      }),
      ...after.required
        .filter((field) => !before.required.includes(field))
        .map((field) => `${name}.${field} is newly required`),
    ];
  }),
  ...Object.entries(previous.mutators).flatMap(([mutator, args]) => {
    const now = current.mutators[mutator];

    return now === undefined || same(args, now)
      ? []
      : [`${mutator} changed its arguments without a new version`];
  }),
];
