/**
 * The corpus gate's numbers (m2-import-corpus.md, section 6, "CI"): every aggregate of a weekly and
 * a timeline evaluation of the pinned corpus. `baseline.json` is public, so it holds aggregates
 * only, never names, tokens or course codes.
 */
import * as Schema from "effect/Schema";
import { Report } from "./Report.ts";

export * as Baseline from "./Baseline.ts";

export const Numbers = Schema.Struct({
  /** The corpus's id, the version the numbers are of. */
  corpus: Schema.String,
  weekly: Report.Aggregates,
  timeline: Report.Aggregates,
});

export type Numbers = typeof Numbers.Type;

export const Json = Schema.fromJsonString(Numbers, { space: 2 });

/** One number that differs, by its path in the file, such as `weekly.views.student.recall`. */
export interface Difference {
  readonly number: string;
  readonly baseline: string;
  readonly measured: string;
}

/** The numbers as plain JSON, as `differences` compares them. */
export const toJson = Schema.encodeEffect(Schema.toCodecJson(Numbers));

const isScalar = Schema.is(
  Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
);

const isText = Schema.is(Schema.String);
const hasFractionFields = Schema.is(Report.Fraction);
const isList = Schema.is(Schema.Array(Schema.Json));
const isObject = Schema.is(Schema.Record(Schema.String, Schema.Json));

/** A fraction is one only with exactly its two fields. */
const isFraction = (value: Schema.Json) =>
  hasFractionFields(value) && Object.keys(value).length === 2;

/** One value in a line: text quoted, so `"5"` and `5` differ, and anything else by its shape. */
const describe = (value: Schema.Json | undefined): string => {
  if (value === undefined) return "nothing";

  if (isScalar(value)) return isText(value) ? `"${value}"` : String(value);

  if (hasFractionFields(value) && isFraction(value)) return `${value.right} of ${value.of}`;

  if (isList(value)) return `[${value.map(describe).join(", ")}]`;

  return isObject(value) ? `{${Object.keys(value).join(", ")}}` : "something else";
};

/** Whether a value holds fields to compare one by one: an object that isn't a fraction. */
const isRecord = (value: Schema.Json | undefined) =>
  value !== undefined && !isList(value) && isObject(value) && !isFraction(value);

/**
 * Walks the committed file and what was measured side by side, field by field, so a number the
 * file lacks, an old one it still has, or one in another place shows up as a difference too.
 */
const compare = (
  baseline: Schema.Json | undefined,
  measured: Schema.Json | undefined,
  path: ReadonlyArray<string>,
): ReadonlyArray<Difference> => {
  if (isRecord(baseline) && isRecord(measured) && isObject(baseline) && isObject(measured)) {
    return [...new Set([...Object.keys(baseline), ...Object.keys(measured)])].flatMap((key) =>
      compare(baseline[key], measured[key], [...path, key]),
    );
  }

  const was = describe(baseline);
  const is = describe(measured);

  return was === is ? [] : [{ number: path.join("."), baseline: was, measured: is }];
};

/** The numbers that differ between the committed file and what was measured, as plain JSON. */
export const differences = (
  baseline: Schema.Json,
  measured: Schema.Json,
): ReadonlyArray<Difference> => compare(baseline, measured, []);

/** What a terminal and CI's last line say about the differences. */
export const summary = (all: ReadonlyArray<Difference>) => {
  const [first] = all;

  return first === undefined
    ? ["Every number equals the baseline."]
    : [
        ...all.map(
          (each) => `  ${each.number}: ${each.measured}, the baseline has ${each.baseline}`,
        ),
        `${all.length === 1 ? "1 number differs" : `${all.length} numbers differ`} from the baseline, such as ${first.number} (${first.measured}, the baseline has ${first.baseline}). Fix the import, or update baseline.json in this commit with the reason.`,
      ];
};
