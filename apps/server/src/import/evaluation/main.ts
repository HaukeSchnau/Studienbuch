// `vp run import:eval`: measures an import on a corpus and prints the headline numbers
// (m2-import-corpus.md, section 6, "The command and the report").
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Corpus } from "../corpus/Corpus.ts";
import { NaiveImport } from "../NaiveImport.ts";
import { Evaluator } from "./Evaluator.ts";
import { TinySchool } from "./fixtures/TinySchool.ts";
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

const encodeReport = Schema.encodeEffect(Report.Json);

/** `2026-W44..2026-W45`, inclusive. */
const parseWeeks = (text: string) => {
  const match = /^(?<from>\d{4}-W\d{2})\.\.(?<to>\d{4}-W\d{2})$/u.exec(text)?.groups;

  return match?.from === undefined || match.to === undefined
    ? Effect.fail(new BadWeeks({ weeks: text }))
    : Effect.succeed({ from: match.from, to: match.to });
};

const evaluate = Effect.fn("ImportEval.evaluate")(function* (flags: {
  readonly corpus: string;
  readonly import: string;
  readonly weeks: Option.Option<string>;
  readonly timeline: boolean;
  readonly json: Option.Option<string>;
}) {
  const importLayer = Object.entries(imports).find(([name]) => name === flags.import)?.[1];

  if (importLayer === undefined) {
    return yield* new UnknownImport({ requested: flags.import, known: Object.keys(imports) });
  }

  const weeks = yield* Effect.transposeOption(Option.map(flags.weeks, parseWeeks));
  const corpus = flags.corpus === "tiny" ? TinySchool.corpus : yield* Corpus.read(flags.corpus);

  const report = yield* Evaluator.evaluate({
    corpus,
    corpusName: corpus.manifest.id,
    importName: flags.import,
    importLayer,
    timeline: flags.timeline,
    weeks,
  });

  yield* Console.log(Report.format(report));

  if (Option.isSome(flags.json)) {
    const fs = yield* FileSystem.FileSystem;

    yield* fs.writeFileString(flags.json.value, `${yield* encodeReport(report)}\n`);
  }
});

const command = Command.make(
  "import-eval",
  {
    corpus: Flag.String("corpus").pipe(
      Flag.withDescription("`tiny` for the invented school, or a corpus directory"),
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
      Flag.withDescription("Run the import every school day instead of every Monday"),
      Flag.withDefault(false),
    ),
    json: Flag.String("json").pipe(
      Flag.withDescription("Also write the numbers to this file"),
      Flag.optional,
    ),
  },
  evaluate,
).pipe(Command.withDescription("Measures an import against a corpus's truth"));

Command.run(command, { version: "0" }).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
