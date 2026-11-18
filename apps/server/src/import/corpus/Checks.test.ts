import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { Checks } from "./Checks.ts";
import { Corpus } from "./Corpus.ts";
import { NamedSchoolTesting } from "./NamedSchoolTesting.ts";
import { Pseudonymizer } from "./Pseudonymizer.ts";

const { object, list, firstEntry, planted } = NamedSchoolTesting;

const pseudonymized = Pseudonymizer.corpus(new Uint8Array(32).fill(7), NamedSchoolTesting.corpus);

const inputOf = (corpus: Corpus.Corpus) => ({
  manifest: corpus.manifest,
  cases: corpus.cases,
  reads: Stream.fromIterable(corpus.reads),
});

const classView = "10/entries/CLASS/111";

layer(NodeServices.layer)("Checks", (it) => {
  it.effect.each([
    {
      name: "a name in free text",
      path: classView,
      plant: (body: NamedSchoolTesting.Mutable) => void (firstEntry(body).lessonText = "Quendolin"),
      problem: {
        path: "days[].gridEntries[].lessonText",
        problem: "text that is neither a kept phrase nor a token",
      },
    },
    {
      name: "a name as a teacher's short name",
      path: "10/filter-TEACHER",
      plant: (body: NamedSchoolTesting.Mutable) =>
        void (object(object(list(body.teachers)[0]).teacher).shortName = "QAM"),
      problem: { path: "teachers[].teacher.shortName", problem: "a name that isn't a token" },
    },
    {
      name: "a name in a field kept as it is",
      path: classView,
      plant: (body: NamedSchoolTesting.Mutable) => void (firstEntry(body).color = "Amselreuter"),
      problem: { path: "days[].gridEntries[].color", problem: "a string outside the vocabulary" },
    },
    {
      name: "an object where a plain value belongs",
      path: classView,
      plant: (body: NamedSchoolTesting.Mutable) =>
        void (firstEntry(body).color = { note: "Material mitbringen" }),
      problem: {
        path: "days[].gridEntries[].color",
        problem: "a list or object where a plain value belongs",
      },
    },
    {
      name: "a name as a new field",
      path: classView,
      plant: (body: NamedSchoolTesting.Mutable) => void (firstEntry(body).coldewey = 1),
      problem: { path: "days[].gridEntries[].coldewey", problem: "a field without a rule" },
    },
    {
      name: "a real id in a person's id",
      path: "10/filter-STUDENT",
      plant: (body: NamedSchoolTesting.Mutable) =>
        void (object(object(list(body.students)[0]).student).id = 501),
      problem: { path: "students[].student.id", problem: "an id outside the pseudonym range" },
    },
  ])("grammar rejects $name", ({ path, plant, problem }) =>
    Effect.gen(function* () {
      const { corpus } = yield* pseudonymized;

      yield* Checks.grammar(inputOf(corpus));

      const error = yield* Effect.flip(Checks.grammar(inputOf(planted(corpus, path, plant))));

      assert.deepStrictEqual(
        error.problems.map(({ path: at, problem: what }) => ({ path: at, problem: what })),
        [problem],
      );
    }),
  );

  it.effect("grammar rejects a corpus id or case id that could name a path", () =>
    Effect.gen(function* () {
      const { corpus } = yield* pseudonymized;

      const error = yield* Effect.flip(
        Checks.grammar(
          inputOf({
            ...corpus,
            manifest: { ...corpus.manifest, id: "../../home" },
            cases: {
              ...corpus.cases,
              terms: [{ id: "Quendolin", start: "2026-08-01", end: "2027-01-31" }],
            },
          }),
        ),
      );

      assert.deepStrictEqual(
        error.problems.map(({ path }) => path),
        ["cases.terms[].id", "id"],
      );
    }),
  );

  it.effect("grammar rejects a raw corpus", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(Checks.grammar(inputOf(NamedSchoolTesting.corpus)));

      assert.strictEqual(error.problems[0]?.problem, "not pseudonymized by this policy");
    }),
  );

  it.effect("layout rejects a file a corpus doesn't hold, and reading rejects a field", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { corpus } = yield* pseudonymized;
      const directory = yield* fs.makeTempDirectoryScoped();

      yield* Corpus.write(directory, corpus);
      yield* Checks.layout(directory);

      yield* fs.writeFileString(path.join(directory, "reads", "notes.txt"), "Quendolin");

      const stray = yield* Effect.flip(Checks.layout(directory));

      assert.strictEqual(
        stray._tag === "Checks.GrammarFailed" ? stray.problems[0]?.problem : stray._tag,
        "a file a corpus doesn't hold",
      );

      yield* fs.remove(path.join(directory, "reads", "notes.txt"));
      yield* fs.writeFileString(
        path.join(directory, "reads", "timegrid.json"),
        '{"versions":[],"note":"Quendolin"}',
      );

      const extra = yield* Effect.flip(Corpus.read(directory));

      assert.strictEqual(extra._tag, "SchemaError");
    }),
  );

  it.effect("scan finds a name anywhere, in any case, and reports its place, never the name", () =>
    Effect.gen(function* () {
      const { corpus, dictionary } = yield* pseudonymized;

      yield* Checks.scan({ dictionary, ...inputOf(corpus) });

      // A key is a field name, which a short name such as `END` can spell.
      const keyed = new Map([...dictionary.names, ["end", "teacher shortName"]]);

      yield* Checks.scan({ dictionary: { ...dictionary, names: keyed }, ...inputOf(corpus) });

      const broken = planted(corpus, classView, (body) => {
        firstEntry(body).color = "Grüße an qam";
      });

      const error = yield* Effect.flip(Checks.scan({ dictionary, ...inputOf(broken) }));

      assert.deepStrictEqual(
        error.hits.map(({ read, path }) => ({ read, path })),
        [{ read: "<year>/entries/CLASS/<id>", path: "days[].gridEntries[].color" }],
      );
      assert.match(error.hits[0]?.problem ?? "", /^a teacher /u);
      assert.deepStrictEqual(
        NamedSchoolTesting.appearances({ hits: error.hits, message: error.message }, "qam"),
        [],
      );

      const vocabulary = corpus.manifest.kept?.vocabulary ?? [];

      const manifest = {
        ...corpus.manifest,
        kept: { phrases: [], vocabulary: [...vocabulary, { value: "Sibylla", count: 1 }] },
      };

      const inManifest = yield* Effect.flip(
        Checks.scan({ dictionary, ...inputOf({ ...corpus, manifest }) }),
      );

      assert.deepStrictEqual(
        inManifest.hits.map(({ read, path }) => ({ read, path })),
        [{ read: "manifest", path: "kept.vocabulary[].value" }],
      );
    }),
  );

  it.effect("scan fails when a real id lies in the pseudonym range", () =>
    Effect.gen(function* () {
      const { corpus, dictionary } = yield* pseudonymized;

      const error = yield* Effect.flip(
        Checks.scan({
          dictionary: { ...dictionary, ids: new Set([...dictionary.ids, 123_456_789_012]) },
          ...inputOf(corpus),
        }),
      );

      assert.strictEqual(error.hits[0]?.problem, "a real id in the pseudonym range");
    }),
  );
});
