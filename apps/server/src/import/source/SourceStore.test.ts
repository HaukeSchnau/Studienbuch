import { assert, describe, expect, it, layer } from "@effect/vitest";
import { School } from "@stu/core";
import { Postgres18 } from "@stu/sync/testing";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as SqlClient from "effect/sql/SqlClient";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { SchoolTesting } from "../../school/SchoolTesting.ts";
import { NamedSchoolTesting } from "../corpus/NamedSchoolTesting.ts";
import { TinySchool } from "../evaluation/TinySchool.ts";
import { SourceStore } from "./SourceStore.ts";

const at = (iso: string) => DateTime.makeUnsafe(iso);

const versions = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly line: string }>`
      select path || ' ' || coalesce(day::text, '-') || ' ' || to_char(observed_at at time zone 'UTC', 'YYYY-MM-DD') as line
      from source_version where school_id = ${school} order by line
    `,
  ).pipe(Effect.map((rows) => rows.map(({ line }) => line)));

describe.skipIf(Postgres18.socket === null)("SourceStore on PostgreSQL 18", () => {
  layer(SchoolTesting.database)((it) => {
    it.effect("writes a version only when its body changed, whatever its keys' order", () =>
      Effect.gen(function* () {
        const school = School.Id.make("store-changed");
        const first = { path: "timegrid", body: { schoolyearId: 10, units: [] } };
        const reordered = { path: "timegrid", body: { units: [], schoolyearId: 10 } };
        const changed = { path: "timegrid", body: { schoolyearId: 11, units: [] } };
        const day = { path: "10/entries/CLASS/111", day: "2026-11-02", body: { days: [] } };

        const written = [
          yield* SourceStore.write(school, at("2026-11-02T05:00:00Z"), [first, day]),
          yield* SourceStore.write(school, at("2026-11-02T05:10:00Z"), [reordered, day]),
          yield* SourceStore.write(school, at("2026-11-02T05:20:00Z"), [changed, day]),
          yield* SourceStore.write(school, at("2026-11-02T05:30:00Z"), [first]),
        ];

        expect(written).toEqual([2, 0, 1, 1]);
      }),
    );

    it.effect("keeps 35 days, and longer only the newest version of a read without a day", () =>
      Effect.gen(function* () {
        const school = School.Id.make("store-pruned");
        const body = (value: number) => ({ days: [], value });

        const read = (path: string, day: string | undefined, value: number) =>
          day === undefined ? { path, body: body(value) } : { path, day, body: body(value) };

        yield* SourceStore.write(school, at("2026-09-01T05:00:00Z"), [
          read("view", "2026-09-01", 1),
          read("directory", undefined, 1),
        ]);

        yield* SourceStore.write(school, at("2026-09-02T05:00:00Z"), [
          read("view", "2026-09-01", 2),
          read("directory", undefined, 2),
        ]);

        // An hour before and after 35 days before the prune.
        yield* SourceStore.write(school, at("2026-09-28T04:00:00Z"), [
          read("view", "2026-09-28", 1),
        ]);

        yield* SourceStore.write(school, at("2026-09-28T06:00:00Z"), [
          read("view", "2026-09-29", 1),
        ]);

        const pruned = yield* SourceStore.prune(school, at("2026-11-02T05:00:00Z"));

        expect({ pruned, kept: yield* versions(school) }).toEqual({
          // The newest version of a past day goes too.
          pruned: 4,
          kept: ["directory - 2026-09-02", "view 2026-09-29 2026-09-28"],
        });
      }),
    );

    it.effect(
      "a window holds what each day showed at its start and every change up to its end",
      () =>
        Effect.gen(function* () {
          const school = School.Id.make("store-window");
          const body = (value: number) => ({ days: [], value });

          const write = (iso: string, value: number, days: ReadonlyArray<string>) =>
            SourceStore.write(school, at(iso), [
              { path: "directory", body: body(value) },
              ...days.map((day) => ({ path: "view", day, body: body(value) })),
            ]);

          yield* write("2026-11-01T05:00:00Z", 1, ["2026-11-01", "2026-11-02", "2026-11-03"]);
          yield* write("2026-11-01T06:00:00Z", 2, ["2026-11-03"]);
          yield* write("2026-11-02T06:00:00Z", 3, ["2026-11-03", "2026-11-04"]);
          yield* write("2026-11-09T06:00:00Z", 4, ["2026-11-04"]);

          const window = { since: at("2026-11-02T00:00:00Z"), until: at("2026-11-09T00:00:00Z") };
          const recording = yield* SourceStore.between(school, School.defaultTimeZone, window);

          const held = [...recording].flatMap(([path, read]) =>
            read.versions.map(
              (version) =>
                `${path} ${version.start ?? "-"} ${DateTime.formatIso(version.observedAt).slice(0, 13)}`,
            ),
          );

          expect(held.toSorted()).toEqual([
            // At its start, and its change during the window; not the one after it.
            "directory - 2026-11-01T06",
            "directory - 2026-11-02T06",
            // The days before the window's first are left out, and so is what a day showed earlier.
            "view 2026-11-02 2026-11-01T05",
            "view 2026-11-03 2026-11-01T06",
            "view 2026-11-03 2026-11-02T06",
            "view 2026-11-04 2026-11-02T06",
          ]);
        }),
    );
  });
});

describe("SourceStore", () => {
  it("refuses a field that holds another kind of value than its rule is for", () => {
    const path = RecordedWebUntis.paths.entries(10, "CLASS", 111);
    const range = { start: "2026-11-02", end: "2026-11-02" };

    const planted = NamedSchoolTesting.planted(TinySchool.corpus, path, (body) => {
      NamedSchoolTesting.firstEntry(body).statusDetail = { student: { displayName: "Schüler 9" } };
    });

    const body = planted.reads.get(path)?.versions[0]?.body ?? null;

    assert.isTrue(Result.isFailure(SourceStore.sanitize({ path, range, body })));
  });

  // Its texts would be kept as a class view's are.
  it("refuses a student's own view whose days say they are of another kind", () => {
    const path = RecordedWebUntis.paths.entries(10, "STUDENT", 501);
    const range = { start: "2026-11-02", end: "2026-11-02" };

    const body = (kind: string) =>
      NamedSchoolTesting.planted(TinySchool.corpus, path, (planted) => {
        for (const day of NamedSchoolTesting.list(planted.days)) {
          NamedSchoolTesting.object(day).resourceType = kind;
        }
      }).reads.get(path)?.versions[0]?.body ?? null;

    assert.deepStrictEqual(
      ["STUDENT", "CLASS"].map((kind) =>
        Result.isSuccess(SourceStore.sanitize({ path, range, body: body(kind) })),
      ),
      [true, false],
    );
  });
});
