// `vp run import:eval`: measures an import on a corpus and prints the headline numbers
// (m2-import-corpus.md, section 6, "The command and the report").
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { CivilTime } from "@stu/core";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Runtime from "effect/Runtime";
import * as Schema from "effect/Schema";
import { Corpus } from "../corpus/Corpus.ts";
import { Pin } from "../corpus/Pin.ts";
import { Sanitized } from "../corpus/Sanitized.ts";
import { NaiveImport } from "../NaiveImport.ts";
import { IgsLilienthal } from "../profiles/IgsLilienthal.ts";
import { Baseline } from "./Baseline.ts";
import { Evaluator } from "./Evaluator.ts";
import { TinySchool } from "./TinySchool.ts";
import { Report } from "./Report.ts";

const imports = { naive: NaiveImport.layer };

class UnknownImport extends Schema.TaggedError<UnknownImport, { readonly brand: unique symbol }>()(
  "ImportEval.UnknownImport",
  { requested: Schema.String, known: Schema.Array(Schema.String) },
) {}

class BadWeeks extends Schema.TaggedError<BadWeeks, { readonly brand: unique symbol }>()(
  "ImportEval.BadWeeks",
  { weeks: Schema.String },
) {}

class Refused extends Schema.TaggedError<Refused, { readonly brand: unique symbol }>()(
  "ImportEval.Refused",
  { reason: Schema.String },
) {}

/** Numbers differ from the baseline. The summary is printed already, as the last line CI shows. */
class Differs extends Schema.TaggedError<Differs, { readonly brand: unique symbol }>()(
  "ImportEval.Differs",
  { count: Schema.Int },
) {
  override readonly [Runtime.errorReported] = false;
}

/** Errors whose fields name ids, paths and counts only, so they print as they are. */
const sanitized = Sanitized.only(
  new Set([
    "ImportEval.UnknownImport",
    "ImportEval.BadWeeks",
    "ImportEval.Refused",
    "ImportEval.Differs",
    "Pin.NotFetched",
    "Truth.Incomplete",
    "Evaluator.NotCaptured",
    "Evaluator.NothingMeasured",
  ]),
);

const encodeReport = Schema.encodeEffect(Report.Json);
const encodeBaseline = Schema.encodeEffect(Baseline.Json);
const decodeJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Json));

const encodeComment = Schema.encodeEffect(
  Schema.fromJsonString(Schema.Struct({ markdown: Schema.String })),
);

const isIsoWeek = Schema.is(CivilTime.IsoWeek);

/** `2026-W44..2026-W45`, inclusive. */
const parseWeeks = (text: string) => {
  const [from, to, ...more] = text.split("..");

  return from === undefined ||
    to === undefined ||
    more.length > 0 ||
    !isIsoWeek(from) ||
    !isIsoWeek(to) ||
    from > to
    ? Effect.fail(new BadWeeks({ weeks: text }))
    : Effect.succeed({ from, to });
};

const evaluate = Effect.fn("ImportEval.evaluate")(function* (flags: {
  readonly corpus: string;
  readonly import: string;
  readonly weeks: Option.Option<string>;
  readonly timeline: boolean;
  readonly json: Option.Option<string>;
  readonly against: Option.Option<string>;
  readonly comment: Option.Option<string>;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const importLayer = Object.entries(imports).find(([name]) => name === flags.import)?.[1];

  if (importLayer === undefined) {
    return yield* new UnknownImport({ requested: flags.import, known: Object.keys(imports) });
  }

  const weeks = yield* Effect.transposeOption(Option.map(flags.weeks, parseWeeks));

  const tiny = flags.corpus === "tiny";

  const corpus = tiny
    ? TinySchool.corpus
    : yield* Corpus.read(flags.corpus === "pinned" ? yield* Pin.cached : flags.corpus);

  const run = (timeline: boolean) =>
    Evaluator.evaluate({
      corpus,
      corpusName: corpus.manifest.id,
      // Every captured corpus is of the one school so far.
      profile: tiny ? TinySchool.profile : IgsLilienthal.profile,
      importName: flags.import,
      importLayer,
      timeline,
      weeks,
    });

  if (Option.isNone(flags.against)) {
    if (Option.isSome(flags.comment))
      return yield* new Refused({ reason: "--comment needs --against" });

    const report = yield* run(flags.timeline);

    yield* Console.log(Report.format(report));

    if (Option.isSome(flags.json)) {
      yield* fs.writeFileString(flags.json.value, `${yield* encodeReport(report)}\n`);
    }

    return;
  }

  if (flags.timeline || Option.isSome(weeks)) {
    return yield* new Refused({
      reason: "--against measures every week, weekly and as a timeline",
    });
  }

  // A gate's output goes to CI's logs, so it holds aggregates only: no worst weeks.
  const { worst: _, ...weekly } = yield* run(false);
  const { worst: __, ...timeline } = yield* run(true);
  const measured: Baseline.Numbers = { corpus: corpus.manifest.id, weekly, timeline };

  yield* Console.log(Report.format({ ...weekly, worst: [] }));
  yield* Console.log("");
  yield* Console.log(Report.format({ ...timeline, worst: [] }));

  const file =
    flags.against.value === "baseline"
      ? yield* path.fromFileUrl(new URL("baseline.json", import.meta.url))
      : flags.against.value;

  const found = Baseline.differences(
    yield* decodeJson(yield* fs.readFileString(file)),
    yield* Baseline.toJson(measured),
  );

  const summary = Baseline.summary(found);

  if (Option.isSome(flags.json)) {
    yield* fs.writeFileString(flags.json.value, `${yield* encodeBaseline(measured)}\n`);
  }

  if (Option.isSome(flags.comment)) {
    const markdown = [
      `**import-eval**, ${flags.import} on \`${measured.corpus}\`: ${summary.at(-1) ?? ""}`,
      "",
      Report.markdown(weekly, timeline),
    ].join("\n");

    yield* fs.writeFileString(flags.comment.value, `${yield* encodeComment({ markdown })}\n`);
  }

  yield* Console.log("");

  for (const line of summary) yield* Console.log(line);

  if (found.length > 0) return yield* new Differs({ count: found.length });
}, sanitized);

const command = Command.make(
  "import-eval",
  {
    corpus: Flag.String("corpus").pipe(
      Flag.withDescription(
        "`tiny` for the invented school, `pinned` for the fetched pin.json, or a corpus directory",
      ),
      Flag.withDefault("tiny"),
    ),
    import: Flag.String("import").pipe(
      Flag.withDescription(`The import to measure: ${Object.keys(imports).join(", ")}`),
      Flag.withDefault("naive"),
    ),
    weeks: Flag.String("weeks").pipe(
      Flag.withDescription("ISO weeks to measure, such as 2026-W44..2026-W45"),
      Flag.optional,
    ),
    timeline: Flag.Boolean("timeline").pipe(
      Flag.withDescription(
        "Run the import at 06:00 and at noon every school day, not every Monday",
      ),
      Flag.withDefault(false),
    ),
    json: Flag.String("json").pipe(
      Flag.withDescription("Also write the numbers to this file, with --against as a baseline"),
      Flag.optional,
    ),
    against: Flag.String("against").pipe(
      Flag.withDescription(
        "Measure both modes and fail on any number that differs from `baseline` (baseline.json) or a file",
      ),
      Flag.optional,
    ),
    comment: Flag.String("comment").pipe(
      Flag.withDescription("With --against: write a pull request comment of aggregates, as JSON"),
      Flag.optional,
    ),
  },
  evaluate,
).pipe(Command.withDescription("Measures an import against a corpus's truth"));

Command.run(command, { version: "0" }).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
