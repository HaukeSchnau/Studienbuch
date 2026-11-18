import * as NodeServices from "@effect/platform-node/NodeServices";
import { WebUntisClient } from "@schnau/webuntis-api";
import type { Schoolyear, TimetableFilter } from "@schnau/webuntis-api/schemas";
import { assert, describe, it, layer } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { TinySchool } from "../evaluation/TinySchool.ts";
import { Capture } from "./Capture.ts";
import { CapturePlan } from "./CapturePlan.ts";
import { Corpus } from "./Corpus.ts";

const capturedAt = DateTime.makeUnsafe("2026-11-13T17:00:00Z");

/**
 * The invented school as WebUntis would answer a capture: every planned day, with the recorded
 * lessons where it has them and no lessons elsewhere.
 */
const answering = (reads: RecordedWebUntis.Recording): RecordedWebUntis.Recording =>
  new Map(
    [...reads].map(([path, read]) => [
      path,
      path.includes("/entries/")
        ? {
            versions: [
              {
                observedAt: DateTime.makeUnsafe("2026-08-01T00:00:00Z"),
                start: "2026-08-13",
                end: "2027-07-07",
                body: { format: 2, days: [], errors: [] },
              },
              ...read.versions,
            ],
          }
        : read,
    ]),
  );

const client = (reads: RecordedWebUntis.Recording) =>
  Layer.effect(
    WebUntisClient,
    Effect.map(RecordedWebUntis.make(reads, { asOf: capturedAt }), ({ client: each }) => each),
  );

layer(NodeServices.layer)("Capture.run", (it) => {
  it.effect("plans 183 requests for the invented school without reading a timetable", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(capturedAt));

      const { plan, manifest } = yield* Capture.run({
        directory: "/nonexistent",
        planOnly: true,
        onPlan: () => Effect.void,
      }).pipe(Effect.provide(client(TinySchool.corpus.reads)));

      assert.isUndefined(manifest);
      assert.strictEqual(plan.requests, 183);
      assert.deepStrictEqual(
        plan.years.map(({ windows, chunks, resources }) => ({
          windows: windows.map(({ start, end }) => `${start}..${end}`),
          chunks: chunks.length,
          students: resources.STUDENT.length,
        })),
        [{ windows: ["2026-08-13..2027-01-08"], chunks: 6, students: 8 }],
      );
    }),
  );

  it.effect("records what WebUntis answered, as the harness replays it", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(capturedAt));

      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();

      const { manifest } = yield* Capture.run({ directory, onPlan: () => Effect.void }).pipe(
        Effect.provide(client(answering(TinySchool.corpus.reads))),
      );

      assert.isDefined(manifest);
      assert.strictEqual(manifest.requests, 183);
      assert.deepStrictEqual(manifest.ranges, [{ start: "2026-08-13", end: "2027-01-08" }]);

      const captured = yield* Corpus.read(directory);

      const replay = (reads: RecordedWebUntis.Recording, asOf: DateTime.Utc) =>
        Effect.map(RecordedWebUntis.make(reads, { asOf }), ({ client: each }) => each);

      const source = yield* replay(TinySchool.corpus.reads, capturedAt);
      const recorded = yield* replay(captured.reads, captured.manifest.capturedAt);

      for (const path of TinySchool.corpus.reads.keys()) {
        if (!path.includes("/entries/")) assert.isTrue(captured.reads.has(path), path);
      }

      // Every view of the invented school, read over its recorded weeks from both recordings.
      for (const resourceType of CapturePlan.types) {
        for (const path of TinySchool.corpus.reads.keys()) {
          const prefix = `10/entries/${resourceType}/`;

          if (!path.startsWith(prefix)) continue;

          const request = {
            start: "2026-10-26",
            end: "2026-11-15",
            resourceType,
            resource: Number(path.slice(prefix.length)),
          };

          assert.deepStrictEqual(
            yield* recorded.timetable.getEntries(request),
            yield* source.timetable.getEntries(request),
            path,
          );
        }
      }
    }),
  );
});

const year = (id: number, name: string, start: string, end: string): Schoolyear => ({
  id,
  name,
  dateRange: { start, end },
});

const current = year(10, "2026/2027", "2026-08-13", "2027-07-07");
const previous = year(9, "2025/2026", "2025-08-01", "2026-07-31");

const filter = (lists: Partial<TimetableFilter>): TimetableFilter => ({
  resourceType: "CLASS",
  preSelected: null,
  buildings: [],
  departments: [],
  roomGroups: [],
  resourceTypes: [],
  assignmentGroups: [],
  classes: [],
  resources: [],
  rooms: [],
  subjects: [],
  students: [],
  teachers: [],
  ...lists,
});

const resource = (id: number, shortName: string) => ({
  id,
  shortName,
  longName: shortName,
  displayName: shortName,
});

const student = (id: number, className: string) => ({
  student: resource(id, `S${id}`),
  classes: [
    {
      class: resource(id + 100, className),
      dateRange: { start: "2025-08-01", end: "2026-07-31" },
      department: null,
    },
  ],
  assignmentGroups: [],
  imageUrl: null,
});

const exam = (start: string, deleted = false) => ({ examStart: `${start}T08:00`, deleted });

const directory = (exams: CapturePlan.Directory["exams"]): CapturePlan.Directory => ({
  filters: {
    CLASS: filter({ classes: [] }),
    TEACHER: filter({ teachers: [] }),
    SUBJECT: filter({ subjects: [] }),
    ROOM: filter({ rooms: [] }),
    STUDENT: filter({
      students: [
        student(1, "10.2"),
        student(2, "11.1"),
        student(3, "12"),
        student(4, "13"),
        student(5, "113"),
      ],
    }),
  },
  exams,
});

describe("CapturePlan.make", () => {
  it.effect.each([
    {
      name: "picks the term boundary, the busiest exam weeks and the weeks before the summer",
      holidays: [
        { id: 1, name: "Sommerferien", start: "2026-07-02", end: "2026-08-12", bookable: false },
      ],
      windows: [
        "2026-01-18..2026-02-14",
        "2026-03-02..2026-03-08",
        "2026-05-04..2026-05-10",
        "2025-11-10..2025-11-16",
        "2026-06-18..2026-07-01",
      ],
    },
    {
      name: "takes the year's last two weeks when no summer holidays are listed",
      holidays: [],
      windows: [
        "2026-01-18..2026-02-14",
        "2026-03-02..2026-03-08",
        "2026-05-04..2026-05-10",
        "2025-11-10..2025-11-16",
        "2026-07-18..2026-07-31",
      ],
    },
  ])("$name", ({ holidays, windows }) =>
    Effect.gen(function* () {
      const exams = [
        ...["2026-03-02", "2026-03-04", "2026-03-06"].map((day) => exam(day)),
        exam("2026-05-05"),
        exam("2026-05-07"),
        exam("2026-06-09"),
        exam("2025-11-12"),
        exam("2026-06-10", true),
      ];

      const plan = yield* CapturePlan.make({
        today: "2026-11-13",
        years: [previous, current],
        holidays,
        directories: new Map([
          [current.id, directory([])],
          [previous.id, directory(exams)],
        ]),
      });

      const [, last] = plan.years;

      assert.isDefined(last);
      assert.deepStrictEqual(
        last.windows.map(({ start, end }) => `${start}..${end}`),
        windows,
      );
      assert.strictEqual(last.chunks.length, windows.length);
      assert.deepStrictEqual(last.resources.STUDENT, [2, 3, 4]);
      assert.strictEqual(plan.requests, 3 + 2 * 6 + 3 * 6 + 3 * windows.length);
    }),
  );

  it.effect("refuses to plan on a day no school year holds", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        CapturePlan.make({
          today: "2027-08-01",
          years: [current],
          holidays: [],
          directories: new Map(),
        }),
      );

      assert.strictEqual(error._tag, "CapturePlan.NoCurrentYear");
    }),
  );
});
