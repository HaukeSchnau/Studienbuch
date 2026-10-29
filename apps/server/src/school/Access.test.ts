import { describe, expect, layer } from "@effect/vitest";
import { Course, School, Term } from "@stu/core";
import { Spaces } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { Access } from "./Access.ts";
import { Fixture } from "./Fixture.ts";
import { Schools } from "./Schools.ts";

const school = School.Id.make("am-see");

const term = Term.Id.make("2026-1");

const offered = { termId: term, gradeLevels: [11], classIds: [] };

const data: Schools.Data = {
  id: school,
  school: { name: "Schule am See", timeZone: "Europe/Berlin" },
  schoolYears: { 2026: { name: "2026/27", dates: { start: "2026-08-01", end: "2027-07-31" } } },
  terms: {
    [term]: {
      schoolYearId: "2026",
      name: "1. Halbjahr 2026/27",
      dates: { start: "2026-08-01", end: "2027-01-31" },
    },
  },
  subjects: {},
  classes: {},
  courses: { "ma-1": { name: "MA-1" }, "ku-1": { name: "KU-1" } },
  offerings: { "ma-1@2026-1": { courseId: "ma-1", ...offered } },
};

const choose = (course: string) =>
  Option.some({ termId: term, gradeLevel: 11, courseIds: [Course.Id.make(course)] });

const notebooks = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql<{ readonly count: number }>`
    select count(*)::int as count from space where kind = 'notebook'
  `,
);

/**
 * Waits until a transaction in this database waits for another's lock, such as the second admission
 * for the first. It asks again at once, because nothing else could tell.
 */
const someoneWaits = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    select 1 from pg_stat_activity
    where datname = current_database() and wait_event_type = 'Lock'
  `,
).pipe(Effect.repeat({ until: (rows) => rows.length > 0 }));

describe.skipIf(Postgres18.socket === null)("Access on PostgreSQL 18", () => {
  layer(Fixture.database)((it) => {
    it.effect("two admissions of one account at once give it one notebook, with its courses", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* Schools.publish(data);
        yield* Fixture.account("lena");
        const firstAdmitted = yield* Deferred.make<void>();
        const commitFirst = yield* Deferred.make<void>();

        const first = yield* Effect.forkChild(
          sql.withTransaction(
            Effect.tap(Access.admit("lena", school, choose("ma-1")), () =>
              Effect.andThen(
                Deferred.succeed(firstAdmitted, undefined),
                Deferred.await(commitFirst),
              ),
            ),
          ),
        );

        yield* Deferred.await(firstAdmitted);
        const second = yield* Effect.forkChild(Access.admit("lena", school, choose("ma-1")));
        yield* someoneWaits;
        yield* Deferred.succeed(commitFirst, undefined);
        const one = yield* Fiber.join(first);
        const other = yield* Fiber.join(second);

        expect({ one, other, memberships: yield* Fixture.memberships("lena") }).toEqual({
          one: { notebook: one.notebook, created: true },
          other: { notebook: one.notebook, created: false },
          memberships: [
            `course ${yield* Schools.courseSpace(school, "ma-1")} reader`,
            `notebook ${one.notebook} owner`,
            "school am-see reader",
          ],
        });
      }),
    );

    it.effect("admitting an account that left the school gives it its memberships back", () =>
      Effect.gen(function* () {
        const spaces = yield* Spaces.Service;
        yield* Schools.publish(data);
        yield* Fixture.account("mia");
        const first = yield* Access.admit("mia", school, choose("ma-1"));
        const admitted = yield* Fixture.memberships("mia");
        yield* spaces.removeMember(first.notebook, "mia");
        yield* spaces.removeMember(school, "mia");
        const left = yield* Fixture.memberships("mia");
        const again = yield* Access.admit("mia", school, Option.none());

        expect({ again, left, back: yield* Fixture.memberships("mia") }).toEqual({
          again: { notebook: first.notebook, created: false },
          left: [],
          back: admitted,
        });
      }),
    );

    it.effect("a first choice that enrollment.set refuses admits nothing", () =>
      Effect.gen(function* () {
        yield* Schools.publish(data);
        yield* Fixture.account("tom");
        const before = yield* notebooks;
        const refusal = yield* Effect.flip(Access.admit("tom", school, choose("ku-1")));

        expect({
          refusal: refusal._tag,
          memberships: yield* Fixture.memberships("tom"),
          notebooks: yield* notebooks,
        }).toEqual({ refusal: "Enrollment.CourseNotOffered", memberships: [], notebooks: before });
      }),
    );
  });
});
