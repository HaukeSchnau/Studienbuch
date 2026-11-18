// `vp run corpus:capture`, `corpus:check` and `corpus:fetch`: the import corpus's tools
// (m2-import-corpus.md, sections 4, 5 and 7). The capture reads WebUntis credentials and the
// pseudonym key from the environment: `sops exec-env secrets/import-capture.env '…'`.
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { WebUntisClient, WebUntisConnection, webUntisLayer } from "@schnau/webuntis-api";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Config from "effect/Config";
import * as Crypto from "effect/Crypto";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { TinySchool } from "../evaluation/TinySchool.ts";
import { Archive } from "./Archive.ts";
import { Capture } from "./Capture.ts";
import { CapturePlan } from "./CapturePlan.ts";
import { CaptureReport } from "./CaptureReport.ts";
import { Checks } from "./Checks.ts";
import { Corpus } from "./Corpus.ts";
import { Pin } from "./Pin.ts";
import { Pseudonymizer } from "./Pseudonymizer.ts";
import { Sanitized } from "./Sanitized.ts";

class Refused extends Schema.TaggedError<Refused, { readonly brand: unique symbol }>()(
  "Corpus.Refused",
  { reason: Schema.String },
) {}

/** Errors whose fields name paths, kinds and counts only, so they print as they are. */
const sanitized = Sanitized.only(
  new Set([
    "Corpus.Refused",
    "Pseudonymizer.PolicyFailed",
    "Pseudonymizer.NotRaw",
    "Checks.LeakFound",
    "Checks.GrammarFailed",
    "Capture.ReadsFailed",
    "CapturePlan.NoCurrentYear",
    "Archive.ArchiveFailed",
    "Pin.NotFetched",
  ]),
);

const pseudonymKey = Effect.gen(function* () {
  const text = Redacted.value(yield* Config.Redacted("CORPUS_PSEUDONYM_KEY"));
  const key = Base64.decode(text);

  return Result.isSuccess(key) && key.success.length === 32
    ? key.success
    : yield* new Refused({ reason: "CORPUS_PSEUDONYM_KEY must be 32 bytes in base64" });
});

const home = Config.String("HOME");

const identityFile = Config.String("SOPS_AGE_KEY_FILE").pipe(
  Config.orElse(() => Config.map(home, (dir) => `${dir}/.config/sops/age/keys.txt`)),
);

const identities = Effect.fn("Corpus.identities")(function* (file: Option.Option<string>) {
  const found = yield* Archive.identitiesIn(Option.isSome(file) ? file.value : yield* identityFile);

  return found.length > 0
    ? found
    : yield* new Refused({ reason: "the identity file holds no age identity" });
});

/** The live client, one connection that keeps two requests in flight at most. */
const live = Layer.unwrap(
  Effect.map(WebUntisConnection.fromEnv, (connection) =>
    webUntisLayer({ ...connection, limits: { concurrency: Capture.concurrency } }),
  ),
).pipe(Layer.provide(FetchHttpClient.layer));

/** A recorded corpus as the client, which can plan a capture without logging in. */
const recorded = (source: string) =>
  Layer.effect(
    WebUntisClient,
    Effect.gen(function* () {
      const corpus = source === "tiny" ? TinySchool.corpus : yield* Corpus.read(source);

      const { client } = yield* RecordedWebUntis.make(corpus.reads, {
        asOf: corpus.manifest.capturedAt,
      });

      return client;
    }),
  );

/** Pseudonymizes a raw capture, checks it, and writes the corpus archive and its report. */
const finish = Effect.fn("Corpus.finish")(function* (input: {
  readonly raw: string;
  readonly work: string;
  readonly out: string;
  readonly recipients: ReadonlyArray<string>;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const key = yield* pseudonymKey;
  const head = yield* Corpus.readHead(input.raw);
  const corpus = yield* fs.makeTempDirectoryScoped({ directory: input.work, prefix: "corpus-" });

  const { manifest, dictionary } = yield* Pseudonymizer.run({
    key,
    manifest: head.manifest,
    reads: Corpus.readEach(input.raw),
    write: (name, read) => Corpus.writeRead(corpus, name, read),
  });

  yield* Corpus.writeHead(corpus, { manifest, cases: head.cases });
  const pseudonymized = { manifest, cases: head.cases, reads: Corpus.readEach(corpus) };

  yield* Checks.scan({ dictionary, ...pseudonymized });
  yield* Checks.grammar(pseudonymized);

  const archive = path.join(input.out, `corpus-${manifest.id}.tar.zst.age`);
  const report = path.join(input.out, `corpus-${manifest.id}.report.md`);

  yield* Archive.pack(corpus, archive, [Archive.owner, ...input.recipients]);
  yield* fs.writeFileString(
    report,
    yield* CaptureReport.make({ manifest, reads: Corpus.readEach(corpus) }),
  );

  yield* Console.log(`Corpus ${archive}`);
  yield* Console.log(`SHA-256 ${yield* Archive.sha256(archive)}`);
  yield* Console.log(`Report ${report}`);
});

/** The layout and the grammar, which together decide whether a corpus directory may be used. */
const checked = Effect.fn("Corpus.checked")(function* (directory: string) {
  yield* Checks.layout(directory);

  const head = yield* Corpus.readHead(directory);

  yield* Checks.grammar({ ...head, reads: Corpus.readEach(directory) });

  return head.manifest;
});

/**
 * Writes every checked file again from its decoded value, so nothing the decoder skipped, such as
 * a repeated key, stays in what a fetch publishes.
 */
const canonical = Effect.fn("Corpus.canonical")(function* (directory: string) {
  yield* Corpus.writeHead(directory, yield* Corpus.readHead(directory));
  yield* Stream.runForEach(Corpus.readEach(directory), ([name, read]) =>
    Corpus.writeRead(directory, name, read),
  );
});

const capture = Command.make(
  "capture",
  {
    plan: Flag.Boolean("plan").pipe(
      Flag.withDescription("Print the request plan and its count, then stop"),
      Flag.withDefault(false),
    ),
    go: Flag.String("go").pipe(
      Flag.withDescription("Read WebUntis live, naming Hauke's go, such as D100"),
      Flag.optional,
    ),
    from: Flag.String("from").pipe(
      Flag.withDescription("With --plan: plan from `tiny` or a corpus directory, without a login"),
      Flag.optional,
    ),
    raw: Flag.String("raw").pipe(
      Flag.withDescription("Pseudonymize this raw archive again instead of reading WebUntis"),
      Flag.optional,
    ),
    rawArchive: Flag.String("raw-archive").pipe(
      Flag.withDescription("Where the raw capture goes, encrypted to Hauke's key only"),
      Flag.optional,
    ),
    out: Flag.String("out").pipe(
      Flag.withDescription("The directory for the corpus archive and its report"),
      Flag.optional,
    ),
    recipient: Flag.String("recipient").pipe(
      Flag.withDescription("Another age recipient of the corpus archive, such as CI's"),
      Flag.atLeast(0),
    ),
    work: Flag.String("work").pipe(
      Flag.withDescription("A tmpfs directory for the plaintext, deleted at the end"),
      Flag.withDefault("/dev/shm"),
    ),
    identity: Flag.String("identity").pipe(
      Flag.withDescription("The age key file that opens --raw (default: SOPS's)"),
      Flag.optional,
    ),
  },
  Effect.fn("Corpus.capture")(function* (flags) {
    const fs = yield* FileSystem.FileSystem;
    const sources = [flags.go, flags.from, flags.raw].filter(Option.isSome).length;

    if (sources !== 1) {
      return yield* new Refused({ reason: "name exactly one of --go, --from and --raw" });
    }

    if (Option.isSome(flags.go) && flags.go.value.trim() === "") {
      return yield* new Refused({ reason: "--go names the go, such as D100" });
    }

    if (Option.isSome(flags.from) && !flags.plan) {
      return yield* new Refused({ reason: "--from only plans; a capture needs --go" });
    }

    const printPlan = (plan: CapturePlan.Plan) => Console.log(CapturePlan.format(plan));

    if (flags.plan) {
      if (Option.isSome(flags.raw)) {
        return yield* new Refused({ reason: "--plan reads WebUntis or a corpus, not --raw" });
      }

      const planning = Capture.run({ directory: flags.work, planOnly: true, onPlan: printPlan });

      yield* Option.isSome(flags.from)
        ? planning.pipe(Effect.provide(recorded(flags.from.value)))
        : planning.pipe(Effect.provide(live));

      return;
    }

    if (Option.isNone(flags.out)) return yield* new Refused({ reason: "name --out" });

    const out = flags.out.value;

    yield* Effect.scoped(
      Effect.gen(function* () {
        const raw = yield* fs.makeTempDirectoryScoped({ directory: flags.work, prefix: "raw-" });

        if (Option.isSome(flags.raw)) {
          yield* Archive.unpack(flags.raw.value, raw, yield* identities(flags.identity));
        } else {
          if (Option.isNone(flags.rawArchive)) {
            return yield* new Refused({ reason: "name --raw-archive for the raw capture" });
          }

          yield* Capture.run({ directory: raw, onPlan: printPlan }).pipe(Effect.provide(live));
          yield* Archive.pack(raw, flags.rawArchive.value, [Archive.owner]);
          yield* Console.log(`Raw capture ${flags.rawArchive.value}, for Hauke's key only`);
        }

        yield* finish({ raw, work: flags.work, out, recipients: flags.recipient });
      }),
    );
  }, sanitized),
).pipe(
  Command.withDescription(
    "Captures WebUntis once and pseudonymizes it into a corpus archive (or plans the capture)",
  ),
);

const check = Command.make(
  "check",
  { corpus: Flag.String("corpus").pipe(Flag.withDescription("An unpacked corpus directory")) },
  Effect.fn("Corpus.check")(function* (flags) {
    const manifest = yield* checked(flags.corpus);
    yield* Console.log(`${manifest.id} follows policy ${manifest.policy}`);
  }, sanitized),
).pipe(Command.withDescription("Checks that every string of a corpus is a token or kept"));

const fetch = Command.make(
  "fetch",
  {
    pinned: Flag.Boolean("pinned").pipe(
      Flag.withDescription("Fetch the archive pin.json names, from its repository and commit"),
      Flag.withDefault(false),
    ),
    archive: Flag.String("archive").pipe(
      Flag.withDescription("The corpus archive, a path, or a file name in --repository"),
      Flag.optional,
    ),
    repository: Flag.String("repository").pipe(
      Flag.withDescription("A git repository holding the archive, cloned or pulled into the cache"),
      Flag.optional,
    ),
    commit: Flag.String("commit").pipe(
      Flag.withDescription("The repository's commit to take the archive from (default: its HEAD)"),
      Flag.optional,
    ),
    sha256: Flag.String("sha256").pipe(
      Flag.withDescription("The archive's expected SHA-256"),
      Flag.optional,
    ),
    identity: Flag.String("identity").pipe(
      Flag.withDescription("The age key file that opens the archive (default: SOPS's)"),
      Flag.optional,
    ),
  },
  Effect.fn("Corpus.fetch")(function* (flags) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const root = yield* Pin.cacheRoot;

    const named = [flags.archive, flags.repository, flags.commit, flags.sha256].filter(
      Option.isSome,
    );

    if (flags.pinned && named.length > 0) {
      return yield* new Refused({ reason: "--pinned takes everything from pin.json" });
    }

    const pin = flags.pinned ? Option.some(yield* Pin.pinned) : Option.none();

    const source = Option.match(pin, {
      onNone: () => flags,
      onSome: (each) => ({
        archive: Option.some(each.archive),
        repository: Option.some(each.repository),
        commit: Option.some(each.commit),
        sha256: Option.some(each.sha256),
      }),
    });

    if (Option.isNone(source.archive)) return yield* new Refused({ reason: "name --archive" });

    if (Option.isSome(source.commit) && Option.isNone(source.repository)) {
      return yield* new Refused({ reason: "--commit needs --repository" });
    }

    yield* fs.makeDirectory(root, { recursive: true });

    let archive = source.archive.value;

    if (Option.isSome(source.repository)) {
      // One clone per repository, so a different URL never pulls the wrong one.
      const crypto = yield* Crypto.Crypto;

      const repository = (yield* fs.exists(source.repository.value))
        ? yield* fs.realPath(source.repository.value)
        : source.repository.value;

      const url = new TextEncoder().encode(repository);

      const clone = path.join(
        root,
        `repository-${Hex.encode(yield* crypto.digest("SHA-256", url)).slice(0, 16)}`,
      );

      const git = (args: ReadonlyArray<string>) =>
        spawner.exitCode(ChildProcess.make("git", args, { stdout: "inherit", stderr: "inherit" }));

      const steps: ReadonlyArray<ReadonlyArray<string>> = [
        ...((yield* fs.exists(path.join(clone, ".git")))
          ? [["-C", clone, "fetch", "--quiet", "origin"]]
          : [["clone", "--quiet", repository, clone]]),
        // The cache's clone is ours, so whatever it holds gives way to the commit asked for.
        [
          "-C",
          clone,
          "checkout",
          "--quiet",
          "--force",
          "--detach",
          Option.getOrElse(source.commit, () => "origin/HEAD"),
        ],
      ];

      for (const args of steps) {
        const code = yield* git(args);

        if (code !== 0) return yield* new Refused({ reason: `git ended with code ${code}` });
      }

      archive = path.join(clone, source.archive.value);
    }

    const actual = yield* Archive.sha256(archive);

    if (Option.isSome(source.sha256) && actual !== source.sha256.value.toLowerCase()) {
      return yield* new Refused({ reason: "the archive's SHA-256 differs from the pin" });
    }

    const unpacked = yield* fs.makeTempDirectory({ directory: root, prefix: "unpack-" });

    // The checked corpus moves into place, so only a failure leaves a directory to remove.
    const directory = yield* Effect.gen(function* () {
      yield* Archive.unpack(archive, unpacked, yield* identities(flags.identity));

      // The grammar has checked the manifest's id before it names the target.
      const manifest = yield* checked(unpacked);

      yield* canonical(unpacked);

      const target = path.join(root, manifest.id);

      yield* fs.remove(Pin.marker(root, manifest.id), { force: true });
      yield* fs.remove(target, { recursive: true, force: true });
      yield* fs.rename(unpacked, target);
      yield* fs.writeFileString(Pin.marker(root, manifest.id), `${actual}\n`);

      return target;
    }).pipe(
      Effect.onError(() => Effect.ignore(fs.remove(unpacked, { recursive: true, force: true }))),
    );

    yield* Console.log(directory);
  }, sanitized),
).pipe(Command.withDescription("Decrypts a corpus archive into the cache and checks its grammar"));

const command = Command.make("corpus").pipe(
  Command.withDescription("The WebUntis import corpus: capture, check and fetch"),
  Command.withSubcommands([capture, check, fetch]),
);

Command.run(command, { version: "0" }).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
