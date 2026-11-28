import { WebUntisClient } from "@schnau/webuntis-api";
import { assert, describe, expect, it, layer } from "@effect/vitest";
import { School } from "@stu/core";
import { Postgres18 } from "@stu/sync/testing";
import * as Age from "age-encryption";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Predicate from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Gitea } from "../../infra/gitea/Gitea.ts";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { SchoolTesting } from "../../school/SchoolTesting.ts";
import { TinySchool } from "../evaluation/TinySchool.ts";
import { ImportRun } from "../ImportRun.ts";
import { ImportTesting } from "../ImportTesting.ts";
import { SourceStore } from "../source/SourceStore.ts";
import { Archive } from "./Archive.ts";
import { Checks } from "./Checks.ts";
import { Corpus } from "./Corpus.ts";
import { Export } from "./Export.ts";
import { NamedSchoolTesting } from "./NamedSchoolTesting.ts";
import { Policy } from "./Policy.ts";

const { morning } = ImportTesting;
const decodePushed = Schema.decodeUnknownEffect(Schema.fromJsonString(Export.Pushed));
const isFailure = Schema.is(Export.Failure);

/** The store as beta's runs leave it: one run over `corpus` at 06:00. */
const stored = (school: School.Id, corpus: Corpus.Corpus) =>
  ImportRun.run({
    profile: { ...TinySchool.profile, id: school },
    nightly: true,
    maximum: 350,
    source: () =>
      Layer.effect(WebUntisClient)(
        Effect.map(RecordedWebUntis.make(corpus.reads, { asOf: morning }), ({ client }) => client),
      ),
  }).pipe(ImportTesting.at(morning));

/** A repository that keeps each commit in memory. */
const repository = Effect.map(Ref.make<ReadonlyArray<Gitea.File>>([]), (files) => ({
  files,
  layer: Layer.succeed(Gitea.Service)(
    Gitea.Service.of({
      commit: (input) =>
        Ref.update(files, (all) => [...all, ...input.files]).pipe(Effect.as({ commit: "c0ffee" })),
    }),
  ),
}));

/** Exports the school's store as of noon, and opens what it committed. */
const exported = Effect.fn("ExportTest.exported")(function* (school: School.Id) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const identity = yield* Effect.promise(() => Age.generateIdentity());
  const recipient = yield* Effect.promise(() => Age.identityToRecipient(identity));
  const target = yield* repository;

  // On the day of its slot, as the weekly job runs it.
  const pushed = yield* Export.run({
    profile: { ...TinySchool.profile, id: school },
    until: ImportTesting.noon,
    recipients: [recipient],
  }).pipe(Effect.provide(target.layer), ImportTesting.at(ImportTesting.noon));

  const files = new Map((yield* Ref.get(target.files)).map((file) => [file.path, file.content]));
  const root = yield* fs.makeTempDirectoryScoped();
  const archive = path.join(root, pushed.archive);
  const directory = path.join(root, "corpus");

  yield* fs.writeFile(archive, files.get(pushed.archive) ?? new Uint8Array());
  yield* Archive.unpack(archive, directory, [identity]);

  // What `corpus:check` and every fetch run.
  yield* Checks.layout(directory);
  const head = yield* Corpus.readHead(directory);
  yield* Checks.grammar({ ...head, reads: Corpus.readEach(directory) });

  const text = (name: string) => new TextDecoder().decode(files.get(name));

  return {
    pushed,
    files: [...files.keys()].toSorted(),
    sha256: text(`${pushed.archive}.sha256`),
    counts: yield* decodePushed(text(`corpus-${pushed.id}.counts.json`)),
    computed: yield* Archive.sha256(archive),
    corpus: yield* Corpus.read(directory),
  };
});

/** Names of students the store can't know, in labels it keeps as WebUntis sent them. */
const unnamedStudents = ["Emil", "林小雨", "ⓔⓜⓘⓛ", "ⅼⅰⅼⅰ", "ͤͫͥᷝ", "Kelly"];

/**
 * The invented school with students' names in an exam's course label, in another script and in
 * letters dressed as symbols, numerals or marks, and in a room that looks like a room number.
 * The store keeps codes and rooms as WebUntis sent them, as it keeps free text.
 */
const withNamedLabels = NamedSchoolTesting.planted(
  NamedSchoolTesting.planted(
    NamedSchoolTesting.corpus,
    RecordedWebUntis.paths.exams(10),
    (body) => {
      const [exam] = NamedSchoolTesting.list(body.exams);

      NamedSchoolTesting.object(exam).studentgroup = {
        id: 900,
        shortName: "FÖ-ⓔⓜⓘⓛ",
        longName: "Förderung Clothilde Mohnblatt ⅼⅰⅼⅰ",
        displayName: "林小雨 FÖ-ͤͫͥᷝ",
      };
    },
  ),
  RecordedWebUntis.paths.entries(10, "CLASS", 111),
  (body) => {
    const entry = NamedSchoolTesting.firstEntryOn(body, "2026-11-11");
    const room = { type: "ROOM", status: "REGULAR", shortName: "Emil 2", longName: "Emil 2" };
    // A Kelvin sign, which NFC makes a capital K.
    const subject = "MA-\u212AELLY";

    entry.position3 = [
      { current: { ...room, displayName: "Emil 2", displayNameLabel: null }, removed: null },
    ];

    entry.position2 = [
      ...NamedSchoolTesting.list(entry.position2),
      {
        current: {
          type: "SUBJECT",
          status: "REGULAR",
          shortName: subject,
          longName: subject,
          displayName: subject,
          displayNameLabel: null,
        },
        removed: null,
      },
    ];
  },
);

/**
 * `value` with every token blanked. A key drawn per export makes random tokens, which can hold a
 * three-letter name such as `QAM` by chance; what's left can't.
 */
const withoutTokens = (value: Policy.Json): Policy.Json => {
  if (Predicate.isString(value)) return value.replace(/[TSPRX][A-Z2-7]{7,8}(?:-\d+)?/gu, "·");

  if (Array.isArray(value)) return value.map(withoutTokens);

  if (!Policy.isObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, withoutTokens(inner)]),
  );
};

/** Every teacher token of the corpus's teacher directory. */
const teacherTokens = (corpus: Corpus.Corpus) =>
  [...corpus.reads]
    .filter(([name]) => name.endsWith("filter-TEACHER"))
    .flatMap(([, read]) => read.versions)
    .flatMap(({ body }) =>
      NamedSchoolTesting.list(NamedSchoolTesting.object(body).teachers).flatMap((each) => {
        const token = NamedSchoolTesting.object(NamedSchoolTesting.object(each).teacher).shortName;

        return Predicate.isString(token) ? [token] : [];
      }),
    )
    .toSorted((a, b) => a.localeCompare(b));

describe.skipIf(Postgres18.socket === null)("Export on PostgreSQL 18", () => {
  layer(SchoolTesting.database, { excludeTestServices: true })((it) => {
    it.effect("exports the store checked, without a name, under its own key, importable", () =>
      Effect.gen(function* () {
        const school = School.Id.make("export-checked");

        yield* stored(school, withNamedLabels);

        const { pushed, files, sha256, counts, computed, corpus } = yield* exported(school);
        const everything = withoutTokens(yield* NamedSchoolTesting.everything(corpus));

        // The harness's import runs on the export as on the store it came from.
        const fromExport = yield* ImportTesting.naive(corpus);

        const fromStore = yield* ImportTesting.naive({
          ...NamedSchoolTesting.corpus,
          reads: yield* SourceStore.recording(school),
        });

        expect({
          files,
          sha256,
          key: counts.key,
          manifest: [corpus.manifest.id, corpus.manifest.policy, corpus.manifest.key],
          names: [...NamedSchoolTesting.names, ...unnamedStudents].filter(
            (name) => NamedSchoolTesting.appearances(everything, name).length > 0,
          ),
          lessons: fromExport.result.lessons.length,
        }).toEqual({
          files: [
            "corpus-export-20261102-1200.counts.json",
            "corpus-export-20261102-1200.tar.zst.age",
            "corpus-export-20261102-1200.tar.zst.age.sha256",
          ],
          sha256: `${computed}  corpus-export-20261102-1200.tar.zst.age\n`,
          key: "per-export",
          manifest: ["export-20261102-1200", Policy.version, "per-export"],
          names: [],
          lessons: fromStore.result.lessons.length,
        });

        assert.strictEqual(pushed.commit, "c0ffee");
        assert.isAbove(fromExport.result.lessons.length, 0);
      }),
    );

    it.effect("two exports of one store share no token and count alike", () =>
      Effect.gen(function* () {
        const school = School.Id.make("export-twice");

        yield* stored(school, NamedSchoolTesting.corpus);

        const first = yield* exported(school);
        const second = yield* exported(school);
        const [one = [], two = []] = [first, second].map(({ corpus }) => teacherTokens(corpus));

        expect({
          sizes: [one.length, two.length],
          shared: one.filter((token) => two.includes(token)),
        }).toEqual({ sizes: [6, 6], shared: [] });

        assert.deepStrictEqual(first.counts.counts, second.counts.counts);
      }),
    );

    it.effect(
      "a week exported after the store may have dropped its start pushes nothing, and says so",
      () =>
        Effect.gen(function* () {
          const school = School.Id.make("export-late");
          const sql = yield* SqlClient.SqlClient;
          const target = yield* repository;

          yield* stored(school, NamedSchoolTesting.corpus);

          const late = (days: number) =>
            Export.run({
              profile: { ...TinySchool.profile, id: school },
              until: ImportTesting.noon,
              recipients: Export.recipients,
            }).pipe(
              Effect.provide(target.layer),
              ImportTesting.at(DateTime.add(ImportTesting.noon, { days })),
              Effect.flip,
              Effect.map((error) => error._tag),
            );

          const rows = sql<{ readonly outcome: string | null }>`
          select outcome from import_export where school_id = ${school} order by started_at
        `;

          // A day late, the oldest read its week can need is older than the store's 35 days.
          expect({
            late: yield* late(1),
            pushed: (yield* Ref.get(target.files)).length,
            rows: (yield* rows).map(({ outcome }) => outcome),
          }).toEqual({ late: "Export.Forgotten", pushed: 0, rows: ["Export.Forgotten"] });
        }),
    );

    it.effect("a read without a range whose week's version the store pruned refuses the week", () =>
      Effect.gen(function* () {
        const school = School.Id.make("export-replaced");
        const sql = yield* SqlClient.SqlClient;
        const target = yield* repository;
        const path = RecordedWebUntis.paths.timeGrid;

        yield* stored(school, NamedSchoolTesting.corpus);

        // A new time grid after the week, and the old one pruned, as it is once 35 days old.
        yield* SourceStore.write(school, DateTime.add(ImportTesting.noon, { hours: 1 }), [
          { path, body: { schoolyearId: 10, units: [] } },
        ]);
        yield* sql`
          delete from source_version where school_id = ${school} and path = ${path}
            and observed_at < ${DateTime.toDateUtc(ImportTesting.noon)}
        `;

        const failed = yield* Export.run({
          profile: { ...TinySchool.profile, id: school },
          until: ImportTesting.noon,
          recipients: Export.recipients,
        }).pipe(
          Effect.provide(target.layer),
          ImportTesting.at(DateTime.add(ImportTesting.noon, { hours: 2 })),
          Effect.flip,
        );

        expect({ failed: failed._tag, pushed: (yield* Ref.get(target.files)).length }).toEqual({
          failed: "Export.Forgotten",
          pushed: 0,
        });
      }),
    );

    it.effect("an export of a field the corpus has no rule for pushes nothing, and says why", () =>
      Effect.gen(function* () {
        const school = School.Id.make("export-unruled");
        const sql = yield* SqlClient.SqlClient;
        const target = yield* repository;

        // The store keeps a student in a lesson's position as a placeholder; the corpus has no rule.
        const withStudent = NamedSchoolTesting.planted(
          TinySchool.corpus,
          RecordedWebUntis.paths.entries(10, "CLASS", 111),
          (body) => {
            const entry = NamedSchoolTesting.firstEntryOn(body, "2026-11-11");

            entry.position4 = [
              ...NamedSchoolTesting.list(entry.position4),
              {
                current: {
                  type: "STUDENT",
                  status: "REGULAR",
                  shortName: "S1",
                  longName: "Schüler 1",
                  displayName: "Schüler 1",
                  displayNameLabel: null,
                },
                removed: null,
              },
            ];
          },
        );

        yield* stored(school, withStudent);

        const failed = yield* Effect.flip(
          Export.run({
            profile: { ...TinySchool.profile, id: school },
            until: ImportTesting.noon,
            recipients: Export.recipients,
          }).pipe(Effect.provide(target.layer), ImportTesting.at(ImportTesting.noon)),
        );

        const rows = yield* sql<{ readonly outcome: string | null; readonly report: unknown }>`
          select outcome, report from import_export where school_id = ${school}
        `;

        expect({
          failed: failed._tag,
          pushed: (yield* Ref.get(target.files)).length,
          rows: rows.map(({ outcome }) => outcome),
          // What `import status` shows: where and what, never the value.
          found: rows.flatMap(({ report }) =>
            (isFailure(report) ? (report.found ?? []) : []).map(
              ({ read, path, problem }) =>
                `${read} ${path.replace("days[].gridEntries[].", "")}: ${problem}`,
            ),
          ),
        }).toEqual({
          failed: "Pseudonymizer.PolicyFailed",
          pushed: 0,
          rows: ["Pseudonymizer.PolicyFailed"],
          found: [
            "<year>/entries/CLASS/<id> position4[].current.displayName: a field without a rule",
            "<year>/entries/CLASS/<id> position4[].current.displayNameLabel: a field without a rule",
            "<year>/entries/CLASS/<id> position4[].current.longName: a field without a rule",
            "<year>/entries/CLASS/<id> position4[].current.shortName: a field without a rule",
            "<year>/entries/CLASS/<id> position4[].current.status: a field without a rule",
            "<year>/entries/CLASS/<id> position4[].current.type: expected an object",
          ],
        });
      }),
    );
  });
});

describe("Export", () => {
  it("lists what a check found only from that check's own failure, never from a defect", () => {
    const hit = { read: "app-data", path: "user.name", problem: "a teacher longName", count: 1 };
    const hits = [hit];

    assert.deepStrictEqual(Export.failureOf(Cause.fail(new Checks.LeakFound({ hits }))), {
      failure: "Checks.LeakFound",
      problems: 1,
      found: hits,
    });

    // A defect can carry a check's error and any value in it, and stays a tag.
    const forged = new Checks.LeakFound({ hits: [{ ...hit, problem: "Wiebke" }] });

    assert.deepStrictEqual(Export.failureOf(Cause.die(forged)), { failure: "Checks.LeakFound" });
  });
});
