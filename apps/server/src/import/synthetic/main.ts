// `vp run synthetic:calibrate` and `synthetic:generate` (M2.11): measure a corpus into the
// committed calibration file, and write a synthetic school's corpus directory from it.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import { Corpus } from "../corpus/Corpus.ts";
import { Pin } from "../corpus/Pin.ts";
import { Sanitized } from "../corpus/Sanitized.ts";
import { IgsLilienthal } from "../profiles/IgsLilienthal.ts";
import { Calibrate } from "./Calibrate.ts";
import { Calibration } from "./Calibration.ts";
import { Committed } from "./Committed.ts";
import { SyntheticSchool } from "./SyntheticSchool.ts";

// A corpus's read or decode error can quote the body it failed on, so only these print whole.
const sanitized = Sanitized.only(new Set(["Pin.NotFetched"]));

const calibrate = Command.make(
  "calibrate",
  {
    corpus: Flag.String("corpus").pipe(
      Flag.withDescription("`pinned` for the fetched pin.json, or a corpus directory"),
      Flag.withDefault("pinned"),
    ),
    out: Flag.String("out").pipe(
      Flag.withDescription("Where to write the calibration, calibration.json by default"),
      Flag.optional,
    ),
  },
  Effect.fn("Synthetic.calibrate")(function* (flags) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = flags.corpus === "pinned" ? yield* Pin.cached : flags.corpus;
    const corpus = yield* Corpus.read(directory);
    const measured = yield* Calibrate.measure(corpus, IgsLilienthal.profile);

    const file = Option.isSome(flags.out)
      ? flags.out.value
      : yield* path.fromFileUrl(new URL("calibration.json", import.meta.url));

    yield* fs.writeFileString(file, `${yield* Calibration.encode(measured)}\n`);
    yield* Console.log(`wrote the calibration of ${measured.terms} terms to ${file}`);
  }, sanitized),
);

const generate = Command.make(
  "generate",
  {
    seed: Flag.Int("seed").pipe(Flag.withDefault(Committed.seed)),
    out: Flag.String("out").pipe(Flag.withDescription("The corpus directory to write")),
  },
  Effect.fn("Synthetic.generate")(function* (flags) {
    const school = yield* SyntheticSchool.generate(yield* Committed.calibration, flags.seed);

    yield* Corpus.write(flags.out, school.corpus);
    yield* Console.log(
      `wrote ${school.corpus.manifest.id}: ${school.students.length} students, ${school.courses.length} courses, ${school.corpus.reads.size} reads`,
    );
  }),
);

Command.run(Command.make("synthetic").pipe(Command.withSubcommands([calibrate, generate])), {
  version: "0",
}).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
