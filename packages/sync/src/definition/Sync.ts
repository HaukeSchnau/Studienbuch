/**
 * The definition API that `packages/core` declares its synced data with: space kinds, tables,
 * mutators (the only writes a client makes) and membership rules. `Sync.schema` collects them with
 * their contract, and each engine checks the result with `Sync.validate` before it starts.
 *
 * ```ts
 * export const Notebook = Sync.spaceKind("notebook", { encryption: "sealed", roles: ["owner"] })
 *
 * export const Row = Sync.table("Homework", {
 *   class: "encrypted",
 *   fields: { courseId: CourseId, title: NonBlankText, dueOn: PlainDateSchema },
 *   indexes: ["dueOn", "courseId"],
 *   writableBy: { notebook: ["owner"] },
 * })
 *
 * export const create = Sync.mutator("homework.create", {
 *   version: 1,
 *   args: CreateArgs,
 *   error: CourseNotChosen,
 *   writes: [Row], // encrypted, so the device seals its result (`Seal`)
 *   spaces: (args) => [args.notebook],
 *   run: Effect.fn("Homework.create")(function* (args) { ... }),
 * })
 * ```
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { Ids } from "../protocol/Ids.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Tx } from "../transaction/Tx.ts";

export * as Sync from "./Sync.ts";

/** Codecs that need no services, because the device and the server both run them. */
type Portable = Schema.Top & {
  readonly DecodingServices: never;
  readonly EncodingServices: never;
};

// Space kinds

export interface SpaceKind<Name extends string = string, Role extends string = string> {
  readonly name: Name;
  /**
   * `sealed`: the space's encrypted rows travel as envelopes and ciphertext under a key per epoch,
   * which only its members' devices hold. Its readable rows stay readable.
   */
  readonly encryption: "none" | "sealed";
  readonly roles: ReadonlyArray<Role>;
  /** `server`: no client command writes the space. The import and `SyncWriter` do. */
  readonly writtenBy: "members" | "server";
}

export const spaceKind = <const Name extends string, const Role extends string>(
  name: Name,
  options: {
    readonly encryption: SpaceKind["encryption"];
    readonly roles: ReadonlyArray<Role>;
    readonly writtenBy?: SpaceKind["writtenBy"];
  },
): SpaceKind<Name, Role> => ({
  name,
  encryption: options.encryption,
  roles: options.roles,
  writtenBy: options.writtenBy ?? "members",
});

// Tables

/**
 * `readable`: the server stores the row as JSON and runs the mutators that write it again.
 * `encrypted`: the row leaves the device as an envelope and ciphertext, and the device's result
 * is final.
 */
export type Class = "readable" | "encrypted";

/** Row fields. */
export type Fields = { readonly [field: string]: Portable };

/** A device view already has these columns for a row's identity, so no table may declare them. */
export const reservedFields = ["space", "id"] as const;

type WithoutReservedFields = { readonly [field in (typeof reservedFields)[number]]?: never };

/**
 * The roles that may write a table, by space kind name. A table without an entry is written by
 * the server only.
 */
export type WritableBy = { readonly [kind: string]: ReadonlyArray<string> };

export interface Table<
  Name extends string = string,
  TableFields extends Fields = Fields,
  Index extends keyof TableFields & string = keyof TableFields & string,
  TableClass extends Class = Class,
> {
  readonly name: Name;
  readonly class: TableClass;
  readonly fields: TableFields;
  /** Fields that `Tx.list` can filter on and the device indexes. */
  readonly indexes: ReadonlyArray<Index>;
  readonly writableBy: WritableBy;
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

/** Table names starting with `_` belong to the engine, such as the key boxes of a sealed space. */
export const table = <
  const Name extends string,
  const TableFields extends Fields & WithoutReservedFields,
  const TableClass extends Class,
  const Index extends keyof TableFields & string = never,
>(
  name: Name,
  options: {
    readonly class: TableClass;
    readonly fields: TableFields;
    readonly indexes?: ReadonlyArray<Index>;
    readonly writableBy?: WritableBy;
  },
): Table<Name, TableFields, Index, TableClass> => {
  const indexCodecs = new Map<string, IndexCodec>();

  return {
    name,
    class: options.class,
    fields: options.fields,
    indexes: options.indexes ?? [],
    writableBy: options.writableBy ?? {},
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

// Mutators

/**
 * How a command reaches the server. `Mutate` sends the arguments, and the server runs the mutator
 * again on its own rows. `Seal` sends the device's result as envelopes and ciphertext, and the
 * server checks what it can see without reading them.
 */
export type Mode = "Mutate" | "Seal";

export type ModeOf<Writes extends ReadonlyArray<Any>> = Writes[number]["class"] extends "encrypted"
  ? "Seal"
  : "Mutate";

/** A command carries one mode, so its tables share one class. */
type OneClass<Writes extends ReadonlyArray<Any>> = "readable" extends Writes[number]["class"]
  ? "encrypted" extends Writes[number]["class"]
    ? "A mutator writes readable tables or encrypted tables, never both"
    : unknown
  : unknown;

export interface Mutator<
  Name extends string = string,
  Args = unknown,
  Refusal extends { readonly _tag: string } = { readonly _tag: string },
  Writes extends ReadonlyArray<Any> = ReadonlyArray<Any>,
> {
  readonly name: Name;
  /** The arguments' version. A device records it with each command, as `name@version`. */
  readonly version: number;
  /** The arguments' JSON codec. A `Mutate` command carries them in its encoded form. */
  readonly args: Schema.Codec<Args, Schema.Json>;
  /** The JSON codec of the refusals the mutator fails with, each tagged `Area.Reason`. */
  readonly error: Schema.Codec<Refusal, Schema.Json>;
  readonly writes: Writes;
  readonly mode: ModeOf<Writes>;
  /**
   * The spaces a command writes. The engines lock them in sorted order and check the actor's
   * role in each before the mutator runs. A write elsewhere is a defect.
   */
  readonly spaces: (args: Args) => ReadonlyArray<string>;
  /**
   * Reads and writes rows through `Tx` only, and reads no clock, randomness or network: ids and
   * times arrive in the arguments. It runs on the device for every command, and again on the
   * server for `Mutate`.
   */
  readonly run: (args: Args) => Effect.Effect<void, Refusal | Tx.Error, Tx.Service>;
}

/** Any mutator, with its arguments' type erased. Engines run one through {@link invoke}. */
export interface AnyMutator {
  readonly name: string;
  readonly version: number;
  readonly args: Schema.Codec<unknown, Schema.Json>;
  readonly error: Schema.Codec<{ readonly _tag: string }, Schema.Json>;
  readonly writes: ReadonlyArray<Any>;
  readonly mode: Mode;
  readonly spaces: (args: never) => ReadonlyArray<string>;
  readonly run: (
    args: never,
  ) => Effect.Effect<void, { readonly _tag: string } | Tx.Error, Tx.Service>;
}

/** A command bound to its decoded arguments. */
export interface Invocation {
  readonly spaces: ReadonlyArray<string>;
  readonly run: Effect.Effect<void, { readonly _tag: string } | Tx.Error, Tx.Service>;
}

/** A command from a newer app than this build. The server answers `Retry`: a deploy race. */
export class NewerVersion extends Schema.TaggedError<
  NewerVersion,
  { readonly brand: unique symbol }
>()("Sync.NewerVersion", { mutator: Schema.String, version: Schema.Int }) {}

/**
 * A command of an older mutator version. Upgrade chains arrive with the first version 2 mutator,
 * and until then the server refuses one as `Sync.InvalidArgs`.
 */
export class OlderVersion extends Schema.TaggedError<
  OlderVersion,
  { readonly brand: unique symbol }
>()("Sync.OlderVersion", { mutator: Schema.String, version: Schema.Int }) {}

/**
 * Decodes a command's arguments as stored in the outbox or sent in `Mutate`, and binds them to its
 * mutator, for the replay on the device and the server's run.
 */
export const invoke = (
  mutator: AnyMutator,
  version: number,
  args: Schema.Json,
): Effect.Effect<Invocation, Schema.SchemaError | NewerVersion | OlderVersion> => {
  if (version > mutator.version) {
    return Effect.fail(new NewerVersion({ mutator: mutator.name, version }));
  }

  if (version < mutator.version) {
    return Effect.fail(new OlderVersion({ mutator: mutator.name, version }));
  }

  return Effect.map(Schema.decodeEffect(mutator.args)(args), (decoded) => {
    // The mutator's own codec decoded them, so they are the arguments its functions take.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    const bound = decoded as never;

    return { spaces: mutator.spaces(bound), run: mutator.run(bound) };
  });
};

export const mutator = <
  const Name extends string,
  const Writes extends readonly [Any, ...ReadonlyArray<Any>],
  ArgsSchema extends Portable,
  ErrorSchema extends Portable & { readonly Type: { readonly _tag: string } } = Schema.Never,
>(
  name: Name,
  options: {
    readonly version: number;
    readonly args: ArgsSchema;
    readonly error?: ErrorSchema;
    readonly writes: Writes & OneClass<Writes>;
    readonly spaces: (args: ArgsSchema["Type"]) => ReadonlyArray<string>;
    readonly run: (
      args: ArgsSchema["Type"],
    ) => Effect.Effect<void, ErrorSchema["Type"] | Tx.Error, Tx.Service>;
  },
): Mutator<Name, ArgsSchema["Type"], ErrorSchema["Type"], Writes> => ({
  name,
  version: options.version,
  args: Schema.toCodecJson(options.args),
  error: Schema.toCodecJson(options.error ?? Schema.Never),
  writes: options.writes,
  mode: modeOf(options.writes),
  spaces: options.spaces,
  run: options.run,
});

const modeOf = <Writes extends ReadonlyArray<Any>>(writes: Writes): ModeOf<Writes> =>
  // `OneClass` keeps the classes of `writes` alike, so the first table decides.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
  (writes[0]?.class === "encrypted" ? "Seal" : "Mutate") as ModeOf<Writes>;

// Membership rules

export interface MembershipRule<From extends Any> {
  /** The kind of the spaces the rule grants. */
  readonly kind: SpaceKind;
  readonly role: string;
  /** A readable table, because the server evaluates the rule on its own rows. */
  readonly from: From;
  /**
   * The spaces whose `role` the members of a space hold, from that space's rows of `from`. The
   * server runs it in every command that writes `from` and applies the difference to the
   * memberships.
   */
  readonly spaces: (rows: ReadonlyArray<Tx.Entry<Row<From>>>) => ReadonlyArray<string>;
}

export const membershipRule = <const Kind extends SpaceKind, const From extends Any>(options: {
  readonly kind: Kind;
  readonly role: Kind["roles"][number];
  readonly from: From;
  readonly spaces: (rows: ReadonlyArray<Tx.Entry<Row<From>>>) => ReadonlyArray<string>;
}): MembershipRule<From> => options;

/** Any membership rule, with its rows' type erased. The server evaluates one through {@link grants}. */
export interface AnyMembershipRule {
  readonly kind: SpaceKind;
  readonly role: string;
  readonly from: Any;
  readonly spaces: (rows: never) => ReadonlyArray<string>;
}

/**
 * The spaces a rule grants the members of `space`, from that space's current rows. It keeps only
 * ids that `existing` reports as spaces of the rule's kind, so an enrollment that names a notebook
 * grants nothing.
 */
export const grants = <E, R>(
  rule: AnyMembershipRule,
  space: string,
  existing: (
    kind: string,
    spaces: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<string>, E, R>,
): Effect.Effect<ReadonlyArray<string>, Tx.Error | E, Tx.Service | R> =>
  Effect.flatMap(Tx.Service, (tx) => tx.list(rule.from, space)).pipe(
    // `tx.list` decoded the rows with the rule's own table.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    Effect.map((rows) => [...new Set(rule.spaces(rows as never))]),
    Effect.flatMap((spaces) => existing(rule.kind.name, spaces)),
  );

// The schema

export interface Definition {
  readonly spaceKinds: ReadonlyArray<SpaceKind>;
  readonly tables: ReadonlyArray<Any>;
  readonly mutators: ReadonlyArray<AnyMutator>;
  readonly membership: ReadonlyArray<AnyMembershipRule>;
  readonly byName: {
    readonly spaceKinds: ReadonlyMap<string, SpaceKind>;
    readonly tables: ReadonlyMap<string, Any>;
    /** By mode first, so a `Mutate` command never finds a mutator whose result is sealed. */
    readonly mutators: { readonly [mode in Mode]: ReadonlyMap<string, AnyMutator> };
  };
  readonly contract: Protocol.Contract;
}

export const schema = (options: {
  /** The definition's version, which the contract carries as `schema`. */
  readonly version: number;
  readonly spaceKinds: ReadonlyArray<SpaceKind>;
  readonly tables: ReadonlyArray<Any>;
  readonly mutators: ReadonlyArray<AnyMutator>;
  readonly membership?: ReadonlyArray<AnyMembershipRule>;
}): Definition => {
  const parts = { ...options, membership: options.membership ?? [] };

  return {
    spaceKinds: parts.spaceKinds,
    tables: parts.tables,
    mutators: parts.mutators,
    membership: parts.membership,
    byName: {
      spaceKinds: byName(parts.spaceKinds),
      tables: byName(parts.tables),
      mutators: {
        Mutate: byName(parts.mutators.filter((mutator) => mutator.mode === "Mutate")),
        Seal: byName(parts.mutators.filter((mutator) => mutator.mode === "Seal")),
      },
    },
    contract: {
      protocol: Protocol.version,
      schema: parts.version,
      hash: hash(describe(parts)),
    },
  };
};

const byName = <A extends { readonly name: string }>(items: ReadonlyArray<A>) =>
  new Map(items.map((item) => [item.name, item]));

const sorted = (names: ReadonlyArray<string>) => [...names].sort();

const sortedBy = <A>(items: ReadonlyArray<A>, key: (item: A) => string) =>
  [...items].sort((left, right) => (key(left) < key(right) ? -1 : 1));

/**
 * Names, not field types: a field never changes its type, and a mutator's arguments change only
 * with its version, so names see every allowed change. JSON Schemas of 15 tables and 15 mutators
 * took 35 ms on Node, which a phone would spend on its JS thread at the first sync.
 */
const describe = (
  parts: Omit<Definition, "byName" | "contract"> & { readonly version: number },
) => ({
  version: parts.version,
  spaceKinds: sortedBy(parts.spaceKinds, (kind) => kind.name),
  tables: sortedBy(parts.tables, (table) => table.name).map((table) => ({
    name: table.name,
    class: table.class,
    fields: sorted(Object.keys(table.fields)),
    indexes: sorted(table.indexes),
    writableBy: table.writableBy,
  })),
  mutators: sortedBy(parts.mutators, (mutator) => mutator.name).map((mutator) => ({
    name: mutator.name,
    version: mutator.version,
    writes: sorted(mutator.writes.map((table) => table.name)),
  })),
  membership: sortedBy(parts.membership, (rule) => `${rule.kind.name} ${rule.from.name}`).map(
    (rule) => ({ kind: rule.kind.name, role: rule.role, from: rule.from.name }),
  ),
});

const hash = (description: ReturnType<typeof describe>) => {
  // Only a name holding U+0000 or a lone surrogate has no canonical form. Its plain JSON text
  // still names the build.
  const text = Result.getOrElse(CanonicalJson.encode(description), () =>
    JSON.stringify(description),
  );

  return bytesToHex(sha256(utf8ToBytes(text))).slice(0, 16);
};

// Validation

export class InvalidDefinition extends Schema.TaggedError<
  InvalidDefinition,
  { readonly brand: unique symbol }
>()("Sync.InvalidDefinition", {
  reason: Schema.Literals([
    // A table name starting with `_`, or a field named `space` or `id`.
    "reserved-name",
    // Two space kinds, tables or mutators with one name.
    "duplicate",
    // A space kind, role or table that the schema doesn't declare.
    "undeclared",
    // A mutator that writes readable and encrypted tables.
    "mixed-classes",
    // A role writing in a space kind only the server writes, or a mutator writing a table no
    // role may write.
    "not-writable",
    // An encrypted table in a space kind without keys, encrypted tables of one kind that
    // different roles write, or a membership rule the server can't read.
    "encryption",
    // A name outside `Ids.Name`, or a mutator version below 1.
    "out-of-bounds",
  ]),
  /** Where, such as `table Homework` or `mutator homework.create`. */
  subject: Schema.String,
}) {}

/** The first rule the definition breaks, or the definition. Engines die on a failure at start. */
export const validate = (definition: Definition): Result.Result<Definition, InvalidDefinition> => {
  const first = problems(definition).next();

  return first.done === true ? Result.succeed(definition) : Result.fail(first.value);
};

const fitsName = Schema.is(Ids.Name);

const isName = (name: string): boolean => fitsName(name);

function* problems(definition: Definition): Generator<InvalidDefinition> {
  const { spaceKinds, tables } = definition.byName;

  const problem = (reason: InvalidDefinition["reason"], subject: string) =>
    new InvalidDefinition({ reason, subject });

  const mutators = new Set(definition.mutators.map((mutator) => mutator.name));

  for (const [what, items, named] of [
    ["space kind", definition.spaceKinds.length, spaceKinds.size],
    ["table", definition.tables.length, tables.size],
    ["mutator", definition.mutators.length, mutators.size],
  ] as const) {
    if (items !== named) yield problem("duplicate", `${what} names`);
  }

  const names = [
    ...definition.spaceKinds.flatMap((kind) => [kind.name, ...kind.roles]),
    ...definition.tables.map((table) => table.name),
    ...mutators,
  ];

  for (const name of names) {
    if (!isName(name)) yield problem("out-of-bounds", `name ${name}`);
  }

  for (const table of definition.tables) {
    const subject = `table ${table.name}`;

    if (table.name.startsWith("_")) yield problem("reserved-name", subject);

    for (const field of reservedFields) {
      if (Object.hasOwn(table.fields, field)) yield problem("reserved-name", `${subject}.${field}`);
    }

    for (const [name, roles] of Object.entries(table.writableBy)) {
      const kind = spaceKinds.get(name);

      if (kind === undefined) {
        yield problem("undeclared", `${subject} in space kind ${name}`);
        continue;
      }

      for (const role of roles) {
        if (!kind.roles.includes(role)) yield problem("undeclared", `${subject}, role ${role}`);
      }

      if (kind.writtenBy === "server") yield problem("not-writable", `${subject} in ${name}`);

      if (table.class === "encrypted" && kind.encryption !== "sealed") {
        yield problem("encryption", `${subject} in ${name}`);
      }
    }
  }

  for (const kind of definition.spaceKinds) {
    // The server sees no table name in a sealed write, so it can check only one set of roles.
    const roleSets = new Set(
      definition.tables
        .filter((table) => table.class === "encrypted")
        .flatMap((table) => {
          const roles = table.writableBy[kind.name];

          return roles === undefined ? [] : [[...roles].sort().join(" ")];
        }),
    );

    if (roleSets.size > 1)
      yield problem("encryption", `roles writing encrypted tables in ${kind.name}`);
  }

  for (const mutator of definition.mutators) {
    const subject = `mutator ${mutator.name}`;

    if (!Number.isSafeInteger(mutator.version) || mutator.version < 1) {
      yield problem("out-of-bounds", `${subject}, version ${mutator.version}`);
    }

    for (const table of mutator.writes) {
      if (tables.get(table.name) !== table)
        yield problem("undeclared", `${subject} writes ${table.name}`);

      if (Object.keys(table.writableBy).length === 0) {
        yield problem("not-writable", `${subject} writes ${table.name}`);
      }
    }

    if (new Set(mutator.writes.map((table) => table.class)).size > 1) {
      yield problem("mixed-classes", subject);
    }
  }

  for (const rule of definition.membership) {
    const subject = `membership rule for ${rule.kind.name} from ${rule.from.name}`;

    if (spaceKinds.get(rule.kind.name) !== rule.kind) yield problem("undeclared", subject);

    if (!rule.kind.roles.includes(rule.role))
      yield problem("undeclared", `${subject}, role ${rule.role}`);

    if (tables.get(rule.from.name) !== rule.from) yield problem("undeclared", subject);

    if (rule.from.class === "encrypted") yield problem("encryption", subject);
  }
}
