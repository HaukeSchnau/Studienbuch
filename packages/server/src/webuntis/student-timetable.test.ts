import { describe, expect, it } from "@effect/vitest";
import { runCrypto } from "../cryptography/testing.ts";
import type {
  DisplayResource,
  TimetableEntries,
  TimetableEntry,
  TimetableEntryDay,
  TimetableStudentFilterItem,
} from "@schnau/webuntis-api";
import { igsLilienthalProfile } from "./school-profile.ts";
import {
  makeStudentTimetableImportPlan,
  projectCourseRosterObservations,
  studentTimetableEntryRequests,
  type StudentTimetableInventory,
} from "./student-timetable.ts";

const makePlan = (input: StudentTimetableInventory) =>
  runCrypto(makeStudentTimetableImportPlan(input));

const resource = (id: number, name: string): DisplayResource => ({
  id,
  shortName: name,
  longName: `${name} long`,
  displayName: `${name} display`,
});

const student = (
  id: number,
  name: string,
  classResource: DisplayResource,
): TimetableStudentFilterItem => ({
  student: resource(id, name),
  classes: [
    {
      class: classResource,
      dateRange: { start: "2026-08-13", end: "2027-07-07" },
      department: null,
    },
  ],
  assignmentGroups: [],
  imageUrl: null,
});

const entry = (ids: ReadonlyArray<number>): TimetableEntry => ({
  ids,
  duration: { start: "08:00", end: "09:30" },
  type: "NORMAL_TEACHING_PERIOD",
  status: "REGULAR",
  layoutStartPosition: 0,
  layoutWidth: 1,
  layoutGroup: 0,
  color: "#ffffff",
  notesAll: null,
  icons: [],
  position1: [
    {
      current: {
        type: "SUBJECT",
        status: "REGULAR",
        shortName: "MA-E",
        longName: "Mathematik Erweiterungskurs",
        displayName: "MA-E",
        displayNameLabel: null,
      },
      removed: null,
    },
  ],
  position2: [],
  position3: [],
  position4: [],
  texts: [],
  lessonText: null,
  lessonInfo: null,
  substitutionText: null,
});

const day = (studentResource: DisplayResource, ids: ReadonlyArray<number>): TimetableEntryDay => ({
  date: "2026-08-24",
  resourceType: "STUDENT",
  resource: studentResource,
  status: "REGULAR",
  dayEntries: [],
  gridEntries: [entry(ids)],
  backEntries: [],
});

const response = (days: ReadonlyArray<TimetableEntryDay>): TimetableEntries => ({
  format: 2,
  days,
  errors: [],
});

const classEightOne = resource(81, "8.1");
const alice = student(1, "Alice Example", classEightOne);
const bob = student(2, "Bob Example", classEightOne);

const inventory = (responses: ReadonlyArray<TimetableEntries>): StudentTimetableInventory => ({
  dataSourceId: "webuntis:school-1",
  school: { externalId: "school-1", name: "Test School", loginName: "igs-lilienthal" },
  academicYear: {
    id: 10,
    name: "2026/2027",
    dateRange: { start: "2026-08-13", end: "2027-07-07" },
  },
  requestedRange: { start: "2026-08-24", end: "2026-08-24" },
  requestedDates: ["2026-08-24"],
  students: [alice, bob],
  responses,
});

describe("WebUntis student timetable import", () => {
  it("bounds entry requests by students and dates", () => {
    const studentIds = Array.from({ length: 1_001 }, (_, index) => index + 1);
    const dates = Array.from(
      { length: 15 },
      (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`,
    );

    const requests = studentTimetableEntryRequests(studentIds, dates);

    expect(requests).toHaveLength(15);
    expect(requests.map(({ start, end, resources }) => [start, end, resources.length])).toEqual([
      ["2026-09-01", "2026-09-03", 500],
      ["2026-09-01", "2026-09-03", 500],
      ["2026-09-01", "2026-09-03", 1],
      ["2026-09-04", "2026-09-06", 500],
      ["2026-09-04", "2026-09-06", 500],
      ["2026-09-04", "2026-09-06", 1],
      ["2026-09-07", "2026-09-09", 500],
      ["2026-09-07", "2026-09-09", 500],
      ["2026-09-07", "2026-09-09", 1],
      ["2026-09-10", "2026-09-12", 500],
      ["2026-09-10", "2026-09-12", 500],
      ["2026-09-10", "2026-09-12", 1],
      ["2026-09-13", "2026-09-15", 500],
      ["2026-09-13", "2026-09-15", 500],
      ["2026-09-13", "2026-09-15", 1],
    ]);
  });

  it("stores complete private views but keeps names out of the preview", () => {
    const first = makePlan(
      inventory([response([day(bob.student, [102, 101]), day(alice.student, [102, 101])])]),
    );
    const reordered = makePlan(
      inventory([response([day(alice.student, [101, 102]), day(bob.student, [101, 102])])]),
    );

    expect(first.preview).toMatchObject({
      studentCount: 2,
      completeDays: 1,
      partialDays: 0,
      wouldImport: { privateOccurrenceViews: 2 },
    });
    expect(JSON.stringify(first.preview)).not.toContain("Alice Example");
    expect(JSON.stringify(first.preview)).not.toContain("Bob Example");
    expect(first.snapshots[0]?.contentHash).toBe(reordered.snapshots[0]?.contentHash);
    expect(first.snapshots[0]?.observations[0]?.payload.student.student.longName).toContain(
      "Alice Example",
    );
  });

  it("projects a name-free roster with stable IGS class progression keys", () => {
    const plan = makePlan(
      inventory([response([day(alice.student, [101]), day(bob.student, [101])])]),
    );
    const rosters = projectCourseRosterObservations({
      observations: plan.snapshots.flatMap((snapshot) => snapshot.observations),
      academicYearStart: 2026,
      profile: igsLilienthalProfile,
    });

    expect(rosters).toHaveLength(1);
    expect(rosters[0]).toMatchObject({
      courseCodes: ["MA-E"],
      regularTeaching: true,
      members: [
        { studentExternalId: "1", schoolGroupKeys: ["ClassGroup:igs-lilienthal/class/2023/1"] },
        { studentExternalId: "2", schoolGroupKeys: ["ClassGroup:igs-lilienthal/class/2023/1"] },
      ],
    });
    expect(JSON.stringify(rosters)).not.toContain("Alice Example");
    expect(JSON.stringify(rosters)).not.toContain("Bob Example");
  });

  it("makes a date partial when a student row is missing", () => {
    const plan = makePlan(inventory([response([day(alice.student, [101])])]));

    expect(plan.preview.days[0]).toMatchObject({
      completeness: "Partial",
      expectedStudentRows: 2,
      returnedStudentRows: 1,
      diagnostics: [{ code: "MissingResourceDay", count: 1 }],
    });
  });
});
