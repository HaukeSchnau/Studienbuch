/**
 * What WebUntis showed for one school, read by read, and the hand-labelled truth it can't carry
 * (m2-import-corpus.md, sections 2 and 3). It lives in a directory, or in memory for an invented
 * school: `manifest.json`, `reads/<RecordedWebUntis path>.json` and `truth/cases.json`.
 */
import { CivilTime, Lesson } from "@stu/core";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { SchoolImport } from "../SchoolImport.ts";

export * as Corpus from "./Corpus.ts";

const Range = Schema.Struct({ start: SchoolImport.Day, end: SchoolImport.Day });

const Counted = Schema.Struct({ value: Schema.String, count: Schema.Int });

export const Manifest = Schema.Struct({
  id: Schema.String,
  capturedAt: Schema.DateTimeUtcFromString,
  /**
   * The pseudonymization policy's version, 0 for an invented school or a raw capture, which no
   * policy has touched.
   */
  policy: Schema.Int,
  timeZone: CivilTime.TimeZone,
  /** The days the timetable reads cover. */
  ranges: Schema.Array(Range),
  /** The requests a capture sent to WebUntis. */
  requests: Schema.optional(Schema.Int),
  /** Entries reads kept as WebUntis sent them although webuntis-api's schemas reject them. */
  decodeFailures: Schema.optional(Schema.Int),
  /** Every string the pseudonymizer kept, with its count, so a person can read the list once. */
  kept: Schema.optional(
    Schema.Struct({ vocabulary: Schema.Array(Counted), phrases: Schema.Array(Counted) }),
  ),
  /**
   * `per-export` when an export drew its tokens' key at random and dropped it, so they match no
   * other corpus. Without it, the capture's kept key made them, as for corpus v1.
   */
  key: Schema.optional(Schema.Literal("per-export")),
});

export type Manifest = typeof Manifest.Type;

/** Meaning WebUntis doesn't carry, labelled by hand. A baseline lists the ids of those that pass. */
export const Cases = Schema.Struct({
  /** The kind of a changed, cancelled or added entry. */
  changes: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      date: SchoolImport.Day,
      entryIds: Schema.Array(Schema.Int),
      kind: Lesson.ChangeKind,
    }),
  ),
  /** Which week is an A-week, such as `2026-W44`. */
  weeks: Schema.Array(
    Schema.Struct({ id: Schema.String, week: Schema.String, label: Schema.String }),
  ),
  /** Days without school, checked against the state's calendar and the school's own free days. */
  closures: Schema.Array(Schema.Struct({ id: Schema.String, ...Range.fields })),
  /** Entries that belong to one course, such as MA23's two rows, or to different ones. */
  courses: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      same: Schema.Boolean,
      entries: Schema.Array(
        Schema.Struct({ date: SchoolImport.Day, ids: Schema.Array(Schema.Int) }),
      ),
    }),
  ),
  /** The terms, for which the harness holds each student's courses as a Kurswahl would. */
  terms: Schema.Array(Schema.Struct({ id: Schema.String, ...Range.fields })),
});

export type Cases = typeof Cases.Type;

export interface Corpus {
  readonly manifest: Manifest;
  readonly reads: RecordedWebUntis.Recording;
  readonly cases: Cases;
}

const ManifestJson = Schema.fromJsonString(Manifest, { space: 2 });
const CasesJson = Schema.fromJsonString(Cases, { space: 2 });
const ReadJson = Schema.fromJsonString(RecordedWebUntis.Read);

// A field the format doesn't know fails, so a corpus file can't carry anything its checks skip.
const strict = { onExcessProperty: "error" } as const;
const decodeManifest = Schema.decodeEffect(ManifestJson, strict);
const decodeCases = Schema.decodeEffect(CasesJson, strict);
const decodeRead = Schema.decodeEffect(ReadJson, strict);
const encodeManifest = Schema.encodeEffect(ManifestJson);
const encodeCases = Schema.encodeEffect(CasesJson);
const encodeRead = Schema.encodeEffect(ReadJson);

export const readHead = Effect.fn("Corpus.readHead")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return {
    manifest: yield* decodeManifest(
      yield* fs.readFileString(path.join(directory, "manifest.json")),
    ),
    cases: yield* decodeCases(
      yield* fs.readFileString(path.join(directory, "truth", "cases.json")),
    ),
  };
});

/**
 * The corpus's reads one by one, in the order of their paths. A real capture holds more than fits
 * in memory as JSON objects, so its tools never load it whole.
 */
export const readEach = (directory: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const readsRoot = path.join(directory, "reads");

      const files = (yield* fs.readDirectory(readsRoot, { recursive: true }))
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.split(path.sep).join("/"))
        .toSorted();

      return Stream.fromIterable(files).pipe(
        Stream.mapEffect((file) =>
          fs.readFileString(path.join(readsRoot, file)).pipe(
            Effect.flatMap(decodeRead),
            Effect.map((recorded) => [file.slice(0, -".json".length), recorded] as const),
          ),
        ),
      );
    }),
  );

export const read = Effect.fn("Corpus.read")(function* (directory: string) {
  const reads = yield* Stream.runCollect(readEach(directory));

  return { ...(yield* readHead(directory)), reads: new Map(reads) } satisfies Corpus;
});

export const writeHead = Effect.fn("Corpus.writeHead")(function* (
  directory: string,
  head: Pick<Corpus, "manifest" | "cases">,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.makeDirectory(path.join(directory, "truth"), { recursive: true });
  yield* fs.writeFileString(
    path.join(directory, "manifest.json"),
    yield* encodeManifest(head.manifest),
  );
  yield* fs.writeFileString(
    path.join(directory, "truth", "cases.json"),
    yield* encodeCases(head.cases),
  );
});

export const writeRead = Effect.fn("Corpus.writeRead")(function* (
  directory: string,
  name: string,
  recorded: RecordedWebUntis.Read,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(directory, "reads", `${name}.json`);

  yield* fs.makeDirectory(path.dirname(file), { recursive: true });
  yield* fs.writeFileString(file, yield* encodeRead(recorded));
});

export const write = Effect.fn("Corpus.write")(function* (directory: string, corpus: Corpus) {
  yield* writeHead(directory, corpus);
  yield* Effect.forEach(corpus.reads, ([name, recorded]) => writeRead(directory, name, recorded), {
    discard: true,
  });
});
