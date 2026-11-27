import { expect, it } from "@effect/vitest";
import { SyncClient } from "@stu/sync/client";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Redacted from "effect/Redacted";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as SqlClient from "effect/sql/SqlClient";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { TimetableState } from "./TimetableState.ts";

// Browser tests only because the engine's imports need a browser: what they test isn't tied to one.

const accountId = "timetable-lena";

const lesson = (courseId: string, date: string, start = 8) =>
  JSON.stringify({
    courseId,
    date,
    start: start * 3_600_000,
    end: (start + 1.5) * 3_600_000,
    teacherIds: [],
    roomIds: [],
    status: "Regular",
  });

/**
 * Lena chose Mathematik and Spanisch for the winter and dropped Spanisch for the summer, and the
 * device still holds Spanisch's Course space with its summer lessons, as `courseMembership` keeps it.
 */
const seed = Effect.gen(function* () {
  yield* Effect.flatMap(SyncClient.Service, (sync) => sync.setOffline(true));
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    insert into sync_space (id, kind, role, version) values
      ('nb-lena', 'notebook', 'owner', 1), ('demo', 'school', 'reader', 1),
      ('c-ma', 'course', 'reader', 1), ('c-sp', 'course', 'reader', 1)
  `;

  yield* sql`
    insert into base_row (space, tbl, id, version, data) values
      ('nb-lena', 'Notebook', 'nb-lena', 1, '{"schoolId":"demo"}'),
      ('demo', 'School', 'demo', 1, '{"name":"Demo-Gymnasium","timeZone":"Europe/Berlin"}'),
      ('demo', 'Term', 'winter', 1, '{"schoolYearId":"y","name":"Winter","dates":{"start":"2026-08-01","end":"2027-01-31"}}'),
      ('demo', 'WeekLabel', '2027-W05', 1, '{"label":"A"}'),
      ('demo', 'Term', 'summer', 1, '{"schoolYearId":"y","name":"Sommer","dates":{"start":"2027-02-01","end":"2027-07-31"}}'),
      ('nb-lena', 'Enrollment', 'winter', 1, '{"termId":"winter","gradeLevel":11,"courseIds":["c-ma","c-sp"]}'),
      ('nb-lena', 'Enrollment', 'summer', 1, '{"termId":"summer","gradeLevel":11,"courseIds":["c-ma"]}'),
      ('c-sp', 'Lesson', 'sp-winter', 1, ${lesson("c-sp", "2027-01-29")}),
      ('c-sp', 'Lesson', 'sp-summer', 1, ${lesson("c-sp", "2027-02-01")}),
      ('c-ma', 'Lesson', 'ma-summer', 1, ${lesson("c-ma", "2027-02-01")}),
      ('c-ma', 'Lesson', 'ma-summer-2', 1, ${lesson("c-ma", "2027-02-01", 9.5)})
  `;
});

it.effect(
  "reads the lessons of the courses chosen for each lesson's term, the week labels, and one lesson whole",
  () =>
    Effect.gen(function* () {
      const registry = AtomRegistry.make();
      yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));

      // Signed in on a public computer, so the engine keeps its data in memory.
      yield* AtomRegistry.getResult(
        registry,
        Atom.runtime(AccountEngine.device).atom(
          Effect.flatMap(SessionStore.Service, (store) =>
            store.signedIn({ accountId, token: Redacted.make("token"), demo: false }, true),
          ),
        ),
      );

      const runtime = Atom.runtime(AccountEngine.app(accountId));
      registry.mount(runtime);

      const [held, opened, dropped] = yield* AtomRegistry.getResult(
        registry,
        runtime.atom(
          Effect.andThen(
            seed,
            Effect.all([
              TimetableState.query.run("2027-01-25"),
              TimetableState.lessonQuery.run("ma-summer"),
              TimetableState.lessonQuery.run("sp-summer"),
            ]),
          ),
        ),
        { suspendOnWaiting: true },
      );

      expect(
        Option.map(held, (reading) => ({
          lessons: Arr.sort(
            reading.plan.lessons.map(({ id }) => id),
            Order.String,
          ),
          weekLabels: [...reading.weekLabels],
        })),
      ).toEqual(
        Option.some({
          lessons: ["ma-summer", "ma-summer-2", "sp-winter"],
          weekLabels: [["2027-W05", "A"]],
        }),
      );

      // The sheet opens a double period whole, and a dropped course's lesson not at all.
      expect(Option.map(opened, ({ lesson }) => [lesson.id, lesson.end / 3_600_000])).toEqual(
        Option.some(["ma-summer", 11]),
      );
      expect(dropped).toEqual(Option.none());
    }).pipe(Effect.scoped),
);
