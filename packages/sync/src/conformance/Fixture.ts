/**
 * `cases.jsonl`: a header naming the engines, then each hand-written case with the outcomes every
 * engine agreed on. The conformance test writes it, and `Replay` runs it on a device's SQLite.
 * Numbers JSON can't hold, which the probe stores on purpose, appear as `{ "$number": "NaN" }`.
 */
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import { Probe } from "./Probe.ts";

export * as Fixture from "./Fixture.ts";

export interface Header {
  readonly table: string;
  readonly engines: ReadonlyArray<string>;
}

export interface Line extends Probe.Trace {
  readonly name: string;
  readonly steps: ReadonlyArray<Probe.Step>;
}

// JSON.stringify and JSON.parse hand their callbacks every value untyped.
/* oxlint-disable anti-slop/no-unknown-parameters -- see above */
const nonFinite = (_key: string, value: unknown) =>
  Predicate.isNumber(value) && !Number.isFinite(value) ? { $number: String(value) } : value;

const revive = (_key: string, value: unknown) =>
  Predicate.isObject(value) &&
  Object.keys(value).length === 1 &&
  "$number" in value &&
  Predicate.isString(value.$number)
    ? Number(value.$number)
    : value;
/* oxlint-enable anti-slop/no-unknown-parameters */

/** One line of the fixture, or a trace in the same encoding, for comparing traces as text. */
export const encode = (value: Header | Line | Probe.Trace) => JSON.stringify(value, nonFinite);

const Row = Schema.Struct(Probe.table.fields);
const Field = Schema.Literals(Struct.keys(Probe.table.fields));

const Step = Schema.Union([
  Schema.Struct({
    op: Schema.Literals(["insert", "put"]),
    id: Schema.String,
    row: Row,
    unset: Schema.optionalKey(Schema.Array(Field)),
  }),
  Schema.Struct({
    op: Schema.Literal("patch"),
    id: Schema.String,
    fields: Row.mapFields(Struct.map(Schema.optionalKey)),
    unset: Schema.optionalKey(Schema.Array(Field)),
  }),
  Schema.Struct({ op: Schema.Literals(["remove", "get"]), id: Schema.String }),
  Schema.Struct({
    op: Schema.Literal("list"),
    where: Schema.optionalKey(
      Schema.Struct({ index: Schema.Literals(Probe.table.indexes), equals: Schema.Unknown }),
    ),
  }),
  Schema.Struct({ op: Schema.Literal("actor") }),
  Schema.Struct({ op: Schema.Literal("seed"), id: Schema.String, json: Schema.Unknown }),
]);

const Case = Schema.Struct({
  name: Schema.String,
  steps: Schema.Array(Step),
  outcomes: Schema.Array(Schema.Unknown),
  stored: Schema.Array(Schema.Unknown),
});

const decodeCase = Schema.decodeUnknownEffect(Case);

export interface Replayable {
  readonly name: string;
  readonly steps: ReadonlyArray<Probe.Step>;
  /** The outcomes and stored rows every engine agreed on, encoded like `encode` does. */
  readonly expected: string;
}

/** The cases of a fixture, each with the trace a device must reproduce. */
export const decode = Effect.fn("Fixture.decode")(function* (text: string) {
  const [, ...lines] = text.split("\n").filter((line) => line !== "");

  return yield* Effect.forEach(lines, (line) =>
    Effect.map(decodeCase(JSON.parse(line, revive)), ({ name, steps, outcomes, stored }) => ({
      name,
      steps,
      // The engines wrote these in this key order, which the traces keep.
      expected: JSON.stringify({ outcomes, stored }, nonFinite),
    })),
  );
});
