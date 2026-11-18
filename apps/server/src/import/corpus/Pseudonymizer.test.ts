import { assert, describe, it } from "@effect/vitest";
import { TimetableFilterSchema } from "@schnau/webuntis-api/schemas";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { Evaluator } from "../evaluation/Evaluator.ts";
import { TinySchool } from "../evaluation/TinySchool.ts";
import { NaiveImport } from "../NaiveImport.ts";
import { Checks } from "./Checks.ts";
import type { Corpus } from "./Corpus.ts";
import { NamedSchoolTesting } from "./NamedSchoolTesting.ts";
import { Policy } from "./Policy.ts";
import { Pseudonymizer } from "./Pseudonymizer.ts";

const key = new Uint8Array(32).fill(7);

const pseudonymized = Pseudonymizer.corpus(key, NamedSchoolTesting.corpus);

const { list, object, firstEntry, planted } = NamedSchoolTesting;

const decodeFilter = Schema.decodeUnknownEffect(TimetableFilterSchema);

const streamOf = (corpus: Corpus.Corpus) => Stream.fromIterable(corpus.reads);

/** Each teacher of the directory as its id and short name. */
const teacherTokens = Effect.fn("PseudonymizerTest.teacherTokens")(function* (
  corpus: Corpus.Corpus,
) {
  const [first] = corpus.reads.get("10/filter-TEACHER")?.versions ?? [];

  assert.isDefined(first);

  const filter = yield* decodeFilter(first.body);

  return filter.teachers.map(({ teacher }) => [teacher.id, teacher.shortName] as const);
});

describe("Pseudonymizer", () => {
  it.effect("leaves no invented name in what it writes, and both checks pass", () =>
    Effect.gen(function* () {
      const { corpus, dictionary } = yield* pseudonymized;
      const written = yield* NamedSchoolTesting.everything(corpus);
      const raw = yield* NamedSchoolTesting.everything(NamedSchoolTesting.corpus);

      // The raw capture holds every name, so a search that finds nothing has looked.
      for (const name of NamedSchoolTesting.names) {
        assert.isNotEmpty(NamedSchoolTesting.appearances(raw, name), name);
        assert.deepStrictEqual(NamedSchoolTesting.appearances(written, name), [], name);
      }

      // The account's email domain names the school, not a person, so it stays out of the dictionary.
      assert.isTrue(dictionary.names.has("pfauenstein"));
      assert.isFalse(dictionary.names.has("invalid"));

      // The free day's holiday row is written, without the names the app data holds.
      assert.isTrue(
        NamedSchoolTesting.appearances(written, "HOLIDAY").some((at) => at.includes("backEntries")),
      );
      assert.deepStrictEqual(NamedSchoolTesting.appearances(written, "Ferientag26"), []);

      const head = { manifest: corpus.manifest, cases: corpus.cases };

      yield* Checks.scan({ dictionary, ...head, reads: streamOf(corpus) });
      yield* Checks.grammar({ ...head, reads: streamOf(corpus) });
    }),
  );

  it.effect(
    "keeps a frequent phrase without a name, and the codes and rooms the import parses",
    () =>
      Effect.gen(function* () {
        const { corpus } = yield* pseudonymized;
        const kept = corpus.manifest.kept;

        assert.isDefined(kept);
        assert.deepStrictEqual(
          kept.phrases.map(({ value }) => value),
          ["Betreuung", "Klausur", "Material mitbringen", "Raumänderung", "Vertretung"],
        );

        const vocabulary = new Set(kept.vocabulary.map(({ value }) => value));

        for (const value of ["11.1", "12", "MA-E", "MA23", "R101", "Deutsch"]) {
          assert.isTrue(vocabulary.has(value), value);
        }

        // The course named after its teacher keeps its code with the teacher's token in place.
        const teacherF = (yield* teacherTokens(corpus)).at(-1)?.[1];

        assert.isTrue(vocabulary.has(`INF-${teacherF}`));
      }),
  );

  it.effect("tokenizes a name word in a code, also where a subject's code spells it", () =>
    Effect.gen(function* () {
      const run = Effect.fn("PseudonymizerTest.run")(function* (raw: Corpus.Corpus) {
        const { corpus, dictionary } = yield* Pseudonymizer.corpus(key, raw);
        const head = { manifest: corpus.manifest, cases: corpus.cases };

        yield* Checks.scan({ dictionary, ...head, reads: streamOf(corpus) });

        return (corpus.manifest.kept?.vocabulary ?? []).map(({ value }) => value);
      });

      // A student called Englisch: the subject of that name could be theirs as well.
      const student = planted(NamedSchoolTesting.corpus, "10/filter-STUDENT", (body) => {
        object(object(list(body.students)[0]).student).longName = "Englisch, Wiebke";
      });

      const subject = yield* run(student);

      assert.notInclude(subject, "Englisch");
      assert.isTrue(subject.some((value) => /^X[A-Z2-7]{8}$/u.test(value)));

      // Courses named after students keep their other words: a name glued to digits, and a short
      // name that holds digits itself.
      const shortName = planted(NamedSchoolTesting.corpus, "10/filter-STUDENT", (body) => {
        object(object(list(body.students)[1]).student).shortName = "WG12";
      });

      const course = planted(shortName, "10/filter-SUBJECT", (body) => {
        object(object(list(body.subjects)[0]).subject).longName = "Förder Wiebke23";
        object(object(list(body.subjects)[1]).subject).longName = "Förder WG12";
      });

      const vocabulary = yield* run(course);

      assert.isTrue(vocabulary.some((value) => /^Förder X[A-Z2-7]{8}23$/u.test(value)));
      assert.isTrue(vocabulary.some((value) => /^Förder X[A-Z2-7]{8}$/u.test(value)));
      assert.isFalse(vocabulary.some((value) => value.includes("Wiebke")));
    }),
  );

  it.effect("fails on a field without a rule, naming its path and never its value", () =>
    Effect.gen(function* () {
      const broken = planted(NamedSchoolTesting.corpus, "10/entries/TEACHER/201", (body) => {
        firstEntry(body).teacherPhone = "Quendolin 0151";
        firstEntry(body).Quendolin = 1;
        firstEntry(body).quendolin = 2;
        // Seen only empty so far.
        firstEntry(body).moved = { from: "Quendolin" };
      });

      const error = yield* Effect.flip(Pseudonymizer.corpus(key, broken));

      assert.strictEqual(Policy.readKind("10/entries/QUENDOLIN/1"), "<unknown read>");

      assert.strictEqual(error._tag, "Pseudonymizer.PolicyFailed");
      assert.deepStrictEqual(error._tag === "Pseudonymizer.PolicyFailed" ? error.problems : [], [
        {
          read: "<year>/entries/TEACHER/<id>",
          path: "days[].gridEntries[].<unknown>",
          problem: "a field without a rule",
          count: 1,
        },
        {
          read: "<year>/entries/TEACHER/<id>",
          path: "days[].gridEntries[].moved.from",
          problem: "a field without a rule",
          count: 1,
        },
        {
          read: "<year>/entries/TEACHER/<id>",
          path: "days[].gridEntries[].<unknown>",
          problem: "a field without a rule",
          count: 1,
        },
        {
          read: "<year>/entries/TEACHER/<id>",
          path: "days[].gridEntries[].teacherPhone",
          problem: "a field without a rule",
          count: 1,
        },
      ]);
      assert.deepStrictEqual(
        NamedSchoolTesting.appearances(
          {
            problems: error._tag === "Pseudonymizer.PolicyFailed" ? error.problems : [],
            message: error.message,
          },
          "Quendolin",
        ),
        [],
      );
    }),
  );

  it.effect("gives the same tokens in every run, and in a capture that lacks a teacher", () =>
    Effect.gen(function* () {
      const first = (yield* pseudonymized).corpus;
      const again = (yield* Pseudonymizer.corpus(key, NamedSchoolTesting.corpus)).corpus;

      assert.deepStrictEqual(again, first);

      // A later capture: teacher A has left the directory, every other person stays.
      const without = planted(NamedSchoolTesting.corpus, "10/filter-TEACHER", (body) => {
        body.teachers = list(body.teachers).slice(1);
      });

      const later = (yield* Pseudonymizer.corpus(key, without)).corpus;

      assert.deepStrictEqual(yield* teacherTokens(later), (yield* teacherTokens(first)).slice(1));

      const other = (yield* Pseudonymizer.corpus(
        new Uint8Array(32).fill(8),
        NamedSchoolTesting.corpus,
      )).corpus;

      assert.notDeepEqual(yield* teacherTokens(other), yield* teacherTokens(first));
    }),
  );

  it.effect("refuses a corpus a policy has already pseudonymized", () =>
    Effect.gen(function* () {
      const { corpus } = yield* pseudonymized;
      const error = yield* Effect.flip(Pseudonymizer.corpus(key, corpus));

      assert.strictEqual(error._tag, "Pseudonymizer.NotRaw");
    }),
  );

  it.effect("changes nothing the naive import measures on the invented school", () =>
    Effect.gen(function* () {
      const evaluate = (corpus: Corpus.Corpus) =>
        Evaluator.evaluate({
          corpus,
          corpusName: corpus.manifest.id,
          importName: "naive",
          importLayer: NaiveImport.layer,
          weeks: Option.none(),
          timeline: true,
        }).pipe(Effect.map(({ worst, ...numbers }) => ({ ...numbers, worst: worst.length })));

      const { corpus } = yield* Pseudonymizer.corpus(key, TinySchool.corpus);

      assert.deepStrictEqual(yield* evaluate(corpus), yield* evaluate(TinySchool.corpus));
    }),
  );
});

describe("Pseudonymizer.isRoomNumber", () => {
  it.each([
    ["A101", true],
    ["NW 2", true],
    ["R1.04", true],
    ["Raum 101", true],
    ["B-12", true],
    ["Müller 2", false],
    ["Raum Coldewey", false],
    ["Sporthalle 1", false],
    ["Aula", false],
  ])("%s is a room number: %s", (room, expected) => {
    assert.strictEqual(Pseudonymizer.isRoomNumber(room), expected);
  });
});
