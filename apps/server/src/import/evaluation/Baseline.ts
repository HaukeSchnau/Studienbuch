/**
 * The corpus gate's numbers (m2-import-corpus.md, section 6, "CI"): every aggregate of a weekly and
 * a timeline evaluation of the pinned corpus. `baseline.json` is public, so it holds aggregates
 * only: no names and no person's token. Subjects key their counts by their codes, as the
 * pseudonymizer kept them or turned them into free-text tokens.
 */
import * as Option from "effect/Option";
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

/**
 * One number that differs, by its path in the file, such as `weekly.views.student.recall` or
 * `weekly.passingCases.0`.
 */
export interface Difference {
  readonly number: string;
  readonly baseline: string;
  readonly measured: string;
}

/** The numbers as plain JSON, as `differences` compares them. */
export const toJson = Schema.encodeEffect(Schema.toCodecJson(Numbers));

const hasFractionFields = Schema.is(Report.Fraction);
const isList = Schema.is(Schema.Array(Schema.Json));
const isObject = Schema.is(Schema.Record(Schema.String, Schema.Json));
const encodeJson = Schema.encodeOption(Schema.fromJsonString(Schema.Json));

/** A fraction is one only with exactly its two fields. */
const isFraction = (value: Schema.Json) =>
  hasFractionFields(value) && Object.keys(value).length === 2;

/** One value in a line: a fraction as `right of total`, anything else as its JSON. */
const describe = (value: Schema.Json | undefined) => {
  if (value === undefined) return "nothing";

  return hasFractionFields(value) && isFraction(value)
    ? `${value.right} of ${value.of}`
    : Option.getOrElse(encodeJson(value), () => "not JSON");
};

/**
 * A list's elements by index, or an object's own fields, so a field one side lacks is never read
 * from a prototype. The kind keeps a list from equalling an object with numbered fields.
 */
const partsOf = (value: Schema.Json | undefined) => {
  if (value === undefined) return undefined;

  if (isList(value))
    return { kind: "list", parts: new Map(value.map((each, i) => [`${i}`, each])) };

  return isObject(value) && !isFraction(value)
    ? { kind: "object", parts: new Map(Object.entries(value)) }
    : undefined;
};

/**
 * Walks the committed file and what was measured side by side, field by field and element by
 * element, so a number the file lacks, an old one it still has, or one in another place shows up
 * as a difference too.
 */
const compare = (
  baseline: Schema.Json | undefined,
  measured: Schema.Json | undefined,
  path: ReadonlyArray<string>,
): ReadonlyArray<Difference> => {
  const was = partsOf(baseline);
  const is = partsOf(measured);

  if (was !== undefined && is !== undefined && was.kind === is.kind) {
    return [...new Set([...was.parts.keys(), ...is.parts.keys()])].flatMap((key) =>
      compare(was.parts.get(key), is.parts.get(key), [...path, key]),
    );
  }

  return describe(baseline) === describe(measured)
    ? []
    : [{ number: path.join("."), baseline: describe(baseline), measured: describe(measured) }];
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
