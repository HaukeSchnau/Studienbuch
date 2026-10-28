import * as Schema from "effect/Schema";

const Homework = Schema.Struct({ title: Schema.String });
const decodeHomework = Schema.decodeUnknownSync(Homework);

const tables = { homework: { codec: Homework } };

// oxlint-disable-next-line studienbuch/no-inline-schema-compile -- fixture: compiled on every call
export const parse = (input: string) => Schema.decodeUnknownSync(Homework)(input);

export const parseInline = (input: string) =>
  // oxlint-disable-next-line studienbuch/no-inline-schema-compile -- fixture: schema and compiler on every call
  Schema.decodeUnknownSync(Schema.Struct({ title: Schema.String }))(input);

export const parseLocal = (input: string) => {
  const Local = Schema.Struct({ title: Schema.String });

  // oxlint-disable-next-line studienbuch/no-inline-schema-compile -- fixture: a schema built in the function
  return Schema.decodeUnknownSync(Local)(input);
};

// Hoisted compilers and a schema the caller passes in pass.
export const parseHoisted = (input: string) => decodeHomework(input);

export const parseWith = (codec: typeof Homework, input: string) =>
  Schema.decodeUnknownSync(codec)(input);

export const parseRow = (table: typeof tables.homework, input: string) =>
  Schema.decodeUnknownSync(table.codec)(input);
