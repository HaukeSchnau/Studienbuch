/**
 * The definition API that `packages/core` uses to declare its synced tables.
 *
 * ```ts
 * export const Row = Sync.table("Homework", {
 *   fields: { courseId: CourseId, title: NonBlankText, dueOn: PlainDateSchema },
 *   indexes: ["dueOn", "courseId"],
 * })
 * ```
 */
import * as Schema from "effect/Schema";

export * as Sync from "./Sync.ts";

/** Row fields. Their codecs need no services, because the device and the server both run them. */
export type Fields = {
  readonly [field: string]: Schema.Constraint & {
    readonly DecodingServices: never;
    readonly EncodingServices: never;
  };
};

export interface Table<
  Name extends string = string,
  TableFields extends Fields = Fields,
  Index extends keyof TableFields & string = keyof TableFields & string,
> {
  readonly name: Name;
  readonly fields: TableFields;
  /** Fields that `Tx.list` can filter on and the device indexes. */
  readonly indexes: ReadonlyArray<Index>;
  /** The row's JSON codec. Both engines store its encoded side as canonical JSON. */
  readonly codec: Schema.Codec<Schema.Struct.Type<TableFields>, unknown>;
  /** The JSON codec of one indexed field, wrapped in an object so optional fields encode too. */
  indexCodec(index: Index): IndexCodec;
}

export type Any = Table<string, Fields, string>;

// One index's field under its name, which is known only at runtime.
// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- see above
export type IndexCodec = Schema.Codec<Record<string, unknown>, unknown>;

export type Row<T extends Any> = Schema.Struct.Type<T["fields"]>;

export type IndexOf<T extends Any> = T["indexes"][number];

export const table = <
  const Name extends string,
  const TableFields extends Fields,
  const Index extends keyof TableFields & string = never,
>(
  name: Name,
  options: { readonly fields: TableFields; readonly indexes?: ReadonlyArray<Index> },
): Table<Name, TableFields, Index> => {
  const indexCodecs = new Map<string, IndexCodec>();

  return {
    name,
    fields: options.fields,
    indexes: options.indexes ?? [],
    codec: Schema.toCodecJson(Schema.Struct(options.fields)),
    indexCodec: (index) => {
      const known = indexCodecs.get(index);

      if (known !== undefined) return known;
      // `index` is a key of the table's fields.
      // oxlint-disable-next-line typescript/no-non-null-assertion -- see above
      const codec = Schema.toCodecJson(Schema.Struct({ [index]: options.fields[index]! }));
      indexCodecs.set(index, codec);

      return codec;
    },
  };
};
