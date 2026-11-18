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

/** A string quoted, so `"5"` and `5` differ. */
const show = (value: string | number | boolean | null) =>
  isText(value) ? `"${value}"` : String(value);

/**
 * Every number by its path, a fraction as `right of total` and a list of values in one line. An
 * object with more than a fraction's two fields isn't one, so its other fields show.
 */
const flatten = (value: Schema.Json, path: string): ReadonlyArray<readonly [string, string]> => {
  const under = (key: string | number) => (path === "" ? `${key}` : `${path}.${key}`);

  if (isScalar(value)) return [[path, show(value)]];

  if (hasFractionFields(value) && Object.keys(value).length === 2) {
    return [[path, `${value.right} of ${value.of}`]];
  }

  if (isList(value)) {
    return value.every(isScalar)
      ? [[path, value.map(show).join(", ")]]
      : value.flatMap((each, index) => flatten(each, under(index)));
  }

  return isObject(value)
    ? Object.entries(value).flatMap(([key, inner]) => flatten(inner, under(key)))
    : [];
};

/**
 * The numbers that differ between the committed file and what was measured. Both are plain JSON,
 * so a number the file lacks, or an old one it still has, shows up as a difference too.
 */
export const differences = (
  baseline: Schema.Json,
  measured: Schema.Json,
): ReadonlyArray<Difference> => {
  const before = new Map(flatten(baseline, ""));
  const now = new Map(flatten(measured, ""));

  return [...new Set([...before.keys(), ...now.keys()])].flatMap((number) => {
    const was = before.get(number) ?? "nothing";
    const is = now.get(number) ?? "nothing";

    return was === is ? [] : [{ number, baseline: was, measured: is }];
  });
};

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
