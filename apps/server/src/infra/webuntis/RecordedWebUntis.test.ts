import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { RecordedWebUntis } from "./RecordedWebUntis.ts";

const day = "2026-11-04";

const student = { id: 501, shortName: "S1", longName: "Schüler 1", displayName: "Schüler 1" };

const timetable = (status: string) => ({
  format: 2,
  days: [
    {
      date: day,
      resourceType: "STUDENT",
      resource: student,
      status: "REGULAR",
      dayEntries: [],
      gridEntries: [
        {
          ids: [1],
          duration: { start: `${day}T13:50`, end: `${day}T15:10` },
          type: "NORMAL_TEACHING_PERIOD",
          status,
          layoutStartPosition: 0,
          layoutWidth: 1000,
          layoutGroup: 0,
          color: "#f4c430",
          notesAll: null,
          icons: [],
          position1: null,
          position2: null,
          position3: null,
          position4: null,
          texts: [],
          lessonText: null,
          lessonInfo: null,
          substitutionText: null,
        },
      ],
      backEntries: [],
    },
  ],
  errors: [],
});

// A cancellation that WebUntis withdrew at 10:00 on the day.
const recording: RecordedWebUntis.Recording = new Map([
  [
    RecordedWebUntis.paths.schoolYears,
    {
      versions: [
        {
          observedAt: DateTime.makeUnsafe("2026-10-23T16:00:00Z"),
          body: [
            { id: 10, name: "2026/2027", dateRange: { start: "2026-08-13", end: "2027-07-07" } },
          ],
        },
      ],
    },
  ],
  [
    RecordedWebUntis.paths.entries(10, "STUDENT", student.id),
    {
      versions: [
        {
          observedAt: DateTime.makeUnsafe("2026-10-23T16:00:00Z"),
          start: "2026-10-26",
          end: "2026-11-08",
          body: timetable("CANCELLED"),
        },
        {
          observedAt: DateTime.makeUnsafe("2026-11-04T09:00:00Z"),
          start: day,
          end: day,
          body: timetable("REGULAR"),
        },
      ],
    },
  ],
]);

const statusesAt = (asOf: string) =>
  Effect.gen(function* () {
    const { client } = yield* RecordedWebUntis.make(recording, { asOf: DateTime.makeUnsafe(asOf) });

    const entries = yield* client.timetable.getEntries({
      resourceType: "STUDENT",
      resource: student.id,
      start: day,
      end: day,
    });

    return entries.days.flatMap((each) => each.gridEntries.map((entry) => entry.status));
  });

describe("RecordedWebUntis", () => {
  it.effect.each([
    {
      name: "before the first observation, the earliest",
      asOf: "2026-10-01T00:00:00Z",
      statuses: ["CANCELLED"],
    },
    {
      name: "before the change, the first version",
      asOf: "2026-11-04T08:59:00Z",
      statuses: ["CANCELLED"],
    },
    {
      name: "after the change, the second version",
      asOf: "2026-11-04T09:00:00Z",
      statuses: ["REGULAR"],
    },
  ])("answers $name", ({ asOf, statuses }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* statusesAt(asOf), statuses);
    }),
  );

  it.effect("fails a read of days it didn't capture, and lists it", () =>
    Effect.gen(function* () {
      const { client, log } = yield* RecordedWebUntis.make(recording, {
        asOf: DateTime.makeUnsafe("2026-11-06T17:00:00Z"),
      });

      const error = yield* client.timetable
        .getEntries({
          resourceType: "STUDENT",
          resource: 501,
          start: "2026-11-06",
          end: "2026-11-09",
        })
        .pipe(Effect.flip);

      assert.deepStrictEqual(
        {
          tag: error._tag,
          cause: error._tag === "TransportError" ? error.cause : undefined,
          log: (yield* log).notCaptured,
        },
        {
          tag: "TransportError",
          cause: new RecordedWebUntis.NotCaptured({ read: "10/entries/STUDENT/501 2026-11-09" }),
          log: ["10/entries/STUDENT/501 2026-11-09"],
        },
      );
    }),
  );
});
