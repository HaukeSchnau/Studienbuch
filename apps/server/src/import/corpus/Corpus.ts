/**
 * What WebUntis showed for one school, read by read, and the hand-labelled truth it can't carry
 * (m2-import-corpus.md, sections 2 and 3). It lives in a directory, or in memory for an invented
 * school: `manifest.json`, `reads/<RecordedWebUntis path>.json` and `truth/cases.json`.
 */
import { CivilTime } from "@stu/core";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { SchoolImport } from "../SchoolImport.ts";

export * as Corpus from "./Corpus.ts";

const Range = Schema.Struct({ start: SchoolImport.Day, end: SchoolImport.Day });

export const Manifest = Schema.Struct({
  id: Schema.String,
  capturedAt: Schema.DateTimeUtcFromString,
  /** The pseudonymization policy's version, 0 for an invented school that needs none. */
  policy: Schema.Int,
  timeZone: CivilTime.TimeZone,
  /** The days the timetable reads cover. */
  ranges: Schema.Array(Range),
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
      kind: SchoolImport.ChangeKind,
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

const decodeManifest = Schema.decodeEffect(ManifestJson);
const decodeCases = Schema.decodeEffect(CasesJson);
const decodeRead = Schema.decodeEffect(ReadJson);
const encodeManifest = Schema.encodeEffect(ManifestJson);
const encodeCases = Schema.encodeEffect(CasesJson);
const encodeRead = Schema.encodeEffect(ReadJson);

export const read = Effect.fn("Corpus.read")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const readsRoot = path.join(directory, "reads");

  const files = (yield* fs.readDirectory(readsRoot, { recursive: true })).filter((file) =>
    file.endsWith(".json"),
  );

  const reads = yield* Effect.forEach(files, (file) =>
    fs.readFileString(path.join(readsRoot, file)).pipe(
      Effect.flatMap(decodeRead),
      Effect.map((recorded) => [file.slice(0, -".json".length), recorded] as const),
    ),
  );

  return {
    manifest: yield* decodeManifest(
      yield* fs.readFileString(path.join(directory, "manifest.json")),
    ),
    reads: new Map(reads),
    cases: yield* decodeCases(
      yield* fs.readFileString(path.join(directory, "truth", "cases.json")),
    ),
  } satisfies Corpus;
});

export const write = Effect.fn("Corpus.write")(function* (directory: string, corpus: Corpus) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.makeDirectory(path.join(directory, "truth"), { recursive: true });
  yield* fs.writeFileString(
    path.join(directory, "manifest.json"),
    yield* encodeManifest(corpus.manifest),
  );
  yield* fs.writeFileString(
    path.join(directory, "truth", "cases.json"),
    yield* encodeCases(corpus.cases),
  );

  yield* Effect.forEach(
    corpus.reads,
    ([name, recorded]) =>
      Effect.gen(function* () {
        const file = path.join(directory, "reads", `${name}.json`);

        yield* fs.makeDirectory(path.dirname(file), { recursive: true });
        yield* fs.writeFileString(file, yield* encodeRead(recorded));
      }),
    { discard: true },
  );
});
