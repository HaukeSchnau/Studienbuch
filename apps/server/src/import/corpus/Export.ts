/**
 * The weekly export (m2-import-path.md, section 7): what beta's source store saw in a week, as a
 * corpus version made with corpus v1's policy under a key drawn for this export alone (D111),
 * checked like a capture, packed for Hauke's and CI's age keys, and committed to the private
 * corpus repository. The store's bodies never leave the server.
 */
import { CivilTime, type School } from "@stu/core";
import type * as Arr from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import { Gitea } from "../../infra/gitea/Gitea.ts";
import type { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { Plan } from "../Plan.ts";
import type { SchoolProfile } from "../profiles/SchoolProfile.ts";
import { SourceStore } from "../source/SourceStore.ts";
import { Archive } from "./Archive.ts";
import { Checks } from "./Checks.ts";
import { Corpus } from "./Corpus.ts";
import { Pseudonymizer } from "./Pseudonymizer.ts";
import { Sanitized } from "./Sanitized.ts";

export * as Export from "./Export.ts";

/** The private corpus repository, which infra keeps off the GitHub mirror. */
export const repository: Gitea.Repository = {
  url: "https://git.schnau.dev",
  owner: "schnau",
  name: "studienbuch-import-corpus",
  branch: "main",
};

/** Days of the store's observations one export holds. */
export const days = 7;

/** Hauke's and CI's age recipients, the same as corpus v1's. */
export const recipients = [Archive.owner, Archive.ci] as const;

/**
 * A token of the one Gitea user who may write the corpus repository. Exports run where it is set,
 * which only beta is.
 */
export const pushToken = Config.option(Config.Redacted("CORPUS_PUSH_TOKEN"));

/** What one export holds, by count. */
export const Counts = Schema.Struct({
  reads: Schema.Int,
  versions: Schema.Int,
  /** The days its timetable reads cover. */
  ranges: Schema.Array(Schema.Struct({ start: Schema.String, end: Schema.String })),
  /** Strings and phrases the pseudonymizer kept, which its manifest lists. */
  vocabulary: Schema.Int,
  phrases: Schema.Int,
});

/** An export as the repository's counts file and `import status` show it. Never a value. */
export const Pushed = Schema.Struct({
  id: Schema.String,
  /** The observations it holds: after `since`, up to `until`. */
  since: Schema.String,
  until: Schema.String,
  policy: Schema.Int,
  key: Schema.Literal("per-export"),
  archive: Schema.String,
  bytes: Schema.Int,
  sha256: Schema.String,
  counts: Counts,
  /** Every check passed, or there would be no archive. */
  checks: Schema.Array(Schema.String),
  commit: Schema.optional(Schema.String),
});

export type Pushed = typeof Pushed.Type;

/** What a check found, as its error lists it: never a value. */
export const Found = Schema.Struct({
  read: Schema.String,
  path: Schema.String,
  problem: Schema.String,
  count: Schema.Int,
});

/**
 * Why an export pushed nothing: a failure's tag, and what its checks found. The server's logs keep
 * a failure's tag alone, so this is where an operator reads why.
 */
export const Failure = Schema.Struct({
  failure: Schema.String,
  problems: Schema.optional(Schema.Int),
  found: Schema.optional(Schema.Array(Found)),
});

export type Failure = typeof Failure.Type;

/** The store saw nothing in the window, so there is nothing to export. */
export class Empty extends Schema.TaggedError<Empty, { readonly brand: unique symbol }>()(
  "Export.Empty",
  { since: Schema.String },
) {}

/**
 * The store may have dropped what the window showed at its start: a day is first read up to
 * `Plan.windowDays - 1` days before it, the store keeps `SourceStore.keptDays` of reads, and of a
 * read without a range only the newest. An export never fills that from anything else.
 */
export class Forgotten extends Schema.TaggedError<Forgotten, { readonly brand: unique symbol }>()(
  "Export.Forgotten",
  { since: Schema.String },
) {}

/** Whether the store still holds every read a window starting at `since` can need, at `now`. */
export const holds = (timeZone: School.Row["timeZone"], since: DateTime.Utc, now: DateTime.Utc) => {
  const dateOf = (at: DateTime.Utc) => CivilTime.dateIn(DateTime.toEpochMillis(at), timeZone);
  const needed = CivilTime.addDays(dateOf(since), -(Plan.windowDays - 1));
  const kept = dateOf(DateTime.subtract(now, { days: SourceStore.keptDays }));

  // A read on the oldest kept date may be older than the cut, so that date doesn't count.
  return CivilTime.order(needed, kept) > 0;
};

/** Errors whose fields name read kinds, paths, problems and counts only. */
const sanitized = Sanitized.only(
  new Set([
    "Export.Empty",
    "Export.Forgotten",
    "Pseudonymizer.PolicyFailed",
    "Pseudonymizer.NotRaw",
    "Checks.LeakFound",
    "Checks.GrammarFailed",
    "Archive.ArchiveFailed",
    "Gitea.CommitRefused",
    "Gitea.CommitUnconfirmed",
  ]),
);

const noCases: Corpus.Cases = { changes: [], weeks: [], closures: [], courses: [], terms: [] };

const encodePushed = Schema.encodeEffect(Schema.fromJsonString(Pushed, { space: 2 }));

const utf8 = (text: string) => new TextEncoder().encode(text);

const iso = (at: DateTime.Utc) => DateTime.formatIso(at);

/** `export-20261130-0030`, in the school's time, like a capture's id. */
const idAt = (at: DateTime.Utc, timeZone: School.Row["timeZone"]) => {
  const parts = DateTime.toParts(DateTime.makeZonedUnsafe(at, { timeZone }));
  const two = (value: number) => String(value).padStart(2, "0");

  return `export-${parts.year}${two(parts.month)}${two(parts.day)}-${two(parts.hour)}${two(parts.minute)}`;
};

/** The days each read's versions name, as one range from the first to the last. */
const rangesOf = (reads: RecordedWebUntis.Recording) => {
  const dates = [...reads.values()]
    .flatMap((read) => read.versions.flatMap((version) => [version.start, version.end]))
    .filter(Predicate.isNotUndefined)
    .toSorted();

  const [start] = dates;
  const end = dates.at(-1);

  return start === undefined || end === undefined ? [] : [{ start, end }];
};

export interface Options {
  readonly profile: SchoolProfile.SchoolProfile;
  /** The end of the observations it holds: the cron's slot, or now. */
  readonly until: DateTime.Utc;
  readonly recipients: Arr.NonEmptyReadonlyArray<string>;
}

/** Makes, checks and commits one export, and returns what it pushed. */
const make = Effect.fn("Export.make")(function* (input: Options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;
  const gitea = yield* Gitea.Service;
  const { timeZone } = input.profile.school;
  const window = { since: DateTime.subtract(input.until, { days }), until: input.until };

  if (!holds(timeZone, window.since, yield* DateTime.now)) {
    return yield* new Forgotten({ since: iso(window.since) });
  }

  const reads = yield* SourceStore.between(input.profile.id, timeZone, window);

  if (reads.size === 0) return yield* new Empty({ since: iso(window.since) });

  // A read without a range keeps only its newest version, which a later one may have replaced.
  if ((yield* SourceStore.undatedPaths(input.profile.id)).some((path) => !reads.has(path))) {
    return yield* new Forgotten({ since: iso(window.since) });
  }

  const id = idAt(input.until, timeZone);
  const work = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-export-" });
  const directory = path.join(work, "corpus");

  const { manifest, dictionary } = yield* Pseudonymizer.run({
    // Drawn here and dropped with this scope: no manifest, report, log or file holds it (D111).
    key: yield* crypto.randomBytes(32),
    manifest: {
      id,
      capturedAt: input.until,
      policy: 0,
      timeZone,
      ranges: rangesOf(reads),
      key: "per-export",
    },
    reads: Stream.fromIterable(reads),
    write: (name, read) => Corpus.writeRead(directory, name, read),
    students: "unnamed",
  });

  yield* Corpus.writeHead(directory, { manifest, cases: noCases });

  const written = { manifest, cases: noCases, reads: Corpus.readEach(directory) };

  yield* Checks.scan({ dictionary, ...written });
  yield* Checks.grammar(written);
  yield* Checks.layout(directory);

  const archive = `corpus-${id}.tar.zst.age`;
  const file = path.join(work, archive);

  yield* Archive.pack(directory, file, input.recipients);

  const content = yield* fs.readFile(file);
  const sha256 = yield* Archive.sha256(file);

  const pushed: Pushed = {
    id,
    since: iso(window.since),
    until: iso(window.until),
    policy: manifest.policy,
    key: "per-export",
    archive,
    bytes: content.length,
    sha256,
    counts: {
      reads: reads.size,
      versions: [...reads.values()].reduce((sum, read) => sum + read.versions.length, 0),
      ranges: manifest.ranges,
      vocabulary: manifest.kept?.vocabulary.length ?? 0,
      phrases: manifest.kept?.phrases.length ?? 0,
    },
    checks: ["dictionary scan", "grammar", "layout"],
  };

  const { commit } = yield* gitea.commit({
    message: [
      `feat: corpus ${id}, from beta's source store`,
      "",
      `The store's reads observed after ${pushed.since} up to ${pushed.until}, pseudonymized with policy ${pushed.policy} under a key of its own: ${pushed.counts.reads} reads, ${pushed.counts.versions} versions.`,
    ].join("\n"),
    files: [
      { path: archive, content },
      { path: `${archive}.sha256`, content: utf8(`${sha256}  ${archive}\n`) },
      { path: `corpus-${id}.counts.json`, content: utf8(`${yield* encodePushed(pushed)}\n`) },
    ],
  });

  return { ...pushed, commit };
}, Effect.scoped);

/** What `import status` may show of a failure: its tag, and how many problems it listed. */
const Reported = Schema.Struct({
  _tag: Schema.String,
  /** The tag a reduced failure had. */
  kind: Schema.optional(Schema.String),
});

const decodeReported = Schema.decodeUnknownOption(Reported);

/** The checks whose errors list where and what kind they found, never a value. */
const isListed = Schema.is(
  Schema.Union([Checks.LeakFound, Checks.GrammarFailed, Pseudonymizer.PolicyFailed]),
);

/**
 * A failure by its tag, or a reduced one by the tag it had, and what its checks found. Only a
 * typed failure of a check lists anything; a defect stays a tag, whatever fields it carries.
 */
export const failureOf = (cause: Cause.Cause<unknown>): Failure => {
  const failure = Option.match(decodeReported(Cause.squash(cause)), {
    onNone: () => "a defect",
    onSome: (error) => (error._tag === "Corpus.Failed" ? (error.kind ?? error._tag) : error._tag),
  });

  const listed = Option.flatMap(Cause.findErrorOption(cause), (error) =>
    isListed(error) ? Option.some("hits" in error ? error.hits : error.problems) : Option.none(),
  );

  return Option.match(listed, {
    onNone: () => ({ failure }),
    onSome: (found) => ({ failure, problems: found.length, found }),
  });
};

interface Recorded {
  readonly outcome: string;
  readonly report: Pushed | Failure;
}

const encodeReport = Schema.encodeEffect(Schema.fromJsonString(Schema.Union([Pushed, Failure])));

/**
 * Exports what the store observed in the `days` before `until`, records the export for `import
 * status`, and fails with a sanitized error when it pushed nothing. It reads no WebUntis.
 */
export const run = Effect.fn("Export.run")(
  function* (input: Options) {
    const sql = yield* SqlClient.SqlClient;
    const startedAt = DateTime.toDateUtc(yield* DateTime.now);

    const [row] = yield* sql<{ readonly id: string }>`
      insert into import_export (id, school_id, started_at)
      values (gen_random_uuid(), ${input.profile.id}, ${startedAt})
      returning id
    `;

    const exit = yield* make(input).pipe(sanitized, Effect.exit);
    const endedAt = DateTime.toDateUtc(yield* DateTime.now);

    const { outcome, report } = Exit.match(exit, {
      onSuccess: (pushed): Recorded => ({ outcome: "Pushed", report: pushed }),
      onFailure: (cause): Recorded => {
        const failure = failureOf(cause);

        return { outcome: failure.failure, report: failure };
      },
    });

    yield* sql`
      update import_export
      set ended_at = ${endedAt}, outcome = ${outcome}, report = ${yield* encodeReport(report)}::jsonb
      where id = ${row?.id ?? ""}
    `;

    return yield* exit;
  },
  Effect.catchTags({ SqlError: Effect.die, SchemaError: Effect.die }),
);
