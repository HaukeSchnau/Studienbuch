import { describe, expect, layer } from "@effect/vitest";
import { School } from "@stu/core";
import { Postgres18 } from "@stu/sync/testing";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { SchoolTesting } from "../../school/SchoolTesting.ts";
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

    it.effect("keeps three months, and the newest version of a day not yet three months past", () =>
      Effect.gen(function* () {
        const school = School.Id.make("store-pruned");
        const body = (value: number) => ({ days: [], value });

        const read = (path: string, day: string | undefined, value: number) =>
          day === undefined ? { path, body: body(value) } : { path, day, body: body(value) };

        yield* SourceStore.write(school, at("2026-07-01T05:00:00Z"), [
          read("view", "2026-07-01", 1),
          read("view", "2026-09-01", 1),
          read("directory", undefined, 1),
        ]);

        yield* SourceStore.write(school, at("2026-07-02T05:00:00Z"), [
          read("view", "2026-07-01", 2),
          read("view", "2026-09-01", 2),
          read("directory", undefined, 2),
        ]);

        yield* SourceStore.write(school, at("2026-10-30T05:00:00Z"), [
          read("view", "2026-11-02", 1),
        ]);

        const pruned = yield* SourceStore.prune(
          school,
          School.defaultTimeZone,
          at("2026-11-02T05:00:00Z"),
        );

        expect({ pruned, kept: yield* versions(school) }).toEqual({
          pruned: 4,
          kept: [
            // A read without a day keeps its newest version however old.
            "directory - 2026-07-02",
            // The newest version of a day less than three months past stays.
            "view 2026-09-01 2026-07-02",
            "view 2026-11-02 2026-10-30",
          ],
        });
      }),
    );
  });
});
