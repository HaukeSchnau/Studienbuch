import { describe, expect, it } from "vite-plus/test";
import type {
  DisplayResource,
  TimetableEntries,
  TimetableEntry,
  TimetableEntryDay,
  TimetableEntryPositionResource,
} from "webuntis-api";
import { makeTimetableImportPlan, type TimetableInventory } from "./timetable.ts";

const resource = (id: number, name: string): DisplayResource => ({
  id,
  shortName: name,
  longName: `${name} long`,
  displayName: `${name} display`,
});

const positionResource = (
  type: string,
  status: string,
  name: string,
): TimetableEntryPositionResource => ({
  type,
  status,
  shortName: name,
  longName: `${name} long`,
  displayName: `${name} display`,
  displayNameLabel: null,
});

const timetableEntry = (overrides: Partial<TimetableEntry> = {}): TimetableEntry => ({
  ids: [102, 101],
  duration: { start: "08:00", end: "09:30" },
  type: "NORMAL_TEACHING_PERIOD",
  status: "REGULAR",
  layoutStartPosition: 0,
  layoutWidth: 1,
  layoutGroup: 0,
  color: "#ffffff",
  notesAll: "",
  icons: [],
  position1: [],
  position2: [],
  position3: [],
  position4: [],
  texts: [],
  lessonText: "",
  lessonInfo: null,
  substitutionText: "",
  ...overrides,
});

const timetableDay = (
  classResource: DisplayResource,
  entries: ReadonlyArray<TimetableEntry>,
  overrides: Partial<TimetableEntryDay> = {},
): TimetableEntryDay => ({
  date: "2026-08-24",
  resourceType: "CLASS",
  resource: classResource,
  status: "REGULAR",
  dayEntries: [],
  gridEntries: entries,
  backEntries: [],
  ...overrides,
});

const response = (
  days: ReadonlyArray<TimetableEntryDay>,
  errors: TimetableEntries["errors"] = [],
): TimetableEntries => ({ format: 2, days, errors });

const classOne = resource(1, "Class 1");
const classTwo = resource(2, "Class 2");

const inventory = (
  responses: ReadonlyArray<TimetableEntries>,
  overrides: Partial<TimetableInventory> = {},
): TimetableInventory => ({
  dataSourceId: "webuntis:school-1",
  academicYear: {
    id: 10,
    name: "2026/2027",
    dateRange: { start: "2026-08-13", end: "2027-07-07" },
  },
  requestedRange: { start: "2026-08-24", end: "2026-08-24" },
  requestedDates: ["2026-08-24"],
  classes: [classOne, classTwo],
  responses,
  ...overrides,
});

describe("WebUntis timetable import", () => {
  it("keeps class views distinct and normalizes their identity and ordering", () => {
    const removedTeacher = positionResource("TEACHER", "REMOVED", "Teacher old");
    const addedTeacher = positionResource("TEACHER", "ADDED", "Teacher new");
    const changed = timetableEntry({
      status: "CHANGED",
      icons: ["NOTES", "HOMEWORK"],
      position1: [{ current: addedTeacher, removed: removedTeacher }],
      position4: [{ current: positionResource("CLASS", "REGULAR", "Class 1"), removed: null }],
    });
    const otherView = timetableEntry({
      ids: [101, 102],
      status: "CHANGED",
      position1: [{ current: addedTeacher, removed: removedTeacher }],
      position4: [{ current: positionResource("CLASS", "REGULAR", "Class 2"), removed: null }],
    });
    const first = makeTimetableImportPlan(
      inventory([
        response([timetableDay(classTwo, [otherView]), timetableDay(classOne, [changed])]),
      ]),
    );
    const reordered = makeTimetableImportPlan(
      inventory([
        response([timetableDay(classOne, [changed]), timetableDay(classTwo, [otherView])]),
      ]),
    );

    expect(first.preview).toMatchObject({
      classCount: 2,
      completeDays: 1,
      partialDays: 0,
      wouldImport: { occurrenceViews: 2 },
    });
    expect(JSON.stringify(first.preview)).not.toContain("Teacher new");
    expect(first.snapshots[0]?.contentHash).toBe(reordered.snapshots[0]?.contentHash);
    expect(first.snapshots[0]?.observations.map((item) => item.externalId)).toEqual([
      "CLASS:1:2026-08-24:101,102",
      "CLASS:2:2026-08-24:101,102",
    ]);
    expect(first.snapshots[0]?.observations[0]?.payload.entry).toMatchObject({
      ids: [101, 102],
      icons: ["HOMEWORK", "NOTES"],
      status: "CHANGED",
      position1: [{ current: addedTeacher, removed: removedTeacher }],
    });
  });

  it("treats an empty response as complete when every class has an explicit no-data row", () => {
    const plan = makeTimetableImportPlan(
      inventory([
        response([
          timetableDay(classOne, [], { status: "NO_DATA" }),
          timetableDay(classTwo, [], { status: "NO_DATA" }),
        ]),
      ]),
    );

    expect(plan.preview.days[0]).toMatchObject({
      completeness: "Complete",
      expectedClassRows: 2,
      returnedClassRows: 2,
      occurrenceViews: 0,
      dayStatuses: { NO_DATA: 2 },
    });
    expect(plan.snapshots[0]).toMatchObject({ completeness: "Complete", observations: [] });
  });

  it("keeps cancellations, additional periods, and response locations in the raw payload", () => {
    const plan = makeTimetableImportPlan(
      inventory([
        response([
          timetableDay(classOne, [timetableEntry({ ids: [201], status: "CANCELLED" })], {
            dayEntries: [
              timetableEntry({
                ids: [202],
                type: "ADDITIONAL_PERIOD",
                status: "ADDITIONAL",
              }),
            ],
            backEntries: [timetableEntry({ ids: [203] })],
          }),
          timetableDay(classTwo, []),
        ]),
      ]),
    );

    expect(plan.preview.days[0]).toMatchObject({
      completeness: "Complete",
      occurrenceViews: 3,
      entryStatuses: { ADDITIONAL: 1, CANCELLED: 1, REGULAR: 1 },
      entryTypes: { ADDITIONAL_PERIOD: 1, NORMAL_TEACHING_PERIOD: 2 },
      entryLocations: { day: 1, grid: 1, back: 1 },
    });
    expect(
      plan.snapshots[0]?.observations.map((observation) => observation.payload.location).sort(),
    ).toEqual(["Back", "Day", "Grid"]);
  });

  it("makes missing, denied, and response-error dates partial so absence cannot delete records", () => {
    const plan = makeTimetableImportPlan(
      inventory([
        response(
          [timetableDay(classOne, [], { status: "NOT_ALLOWED_FOR_RESOURCE" })],
          [{ code: "provider-warning" }],
        ),
      ]),
    );

    expect(plan.snapshots[0]?.completeness).toBe("Partial");
    expect(plan.preview.days[0]?.diagnostics).toEqual(
      expect.arrayContaining([
        { severity: "Error", code: "MissingResourceDay", count: 1, date: "2026-08-24" },
        { severity: "Error", code: "NotAllowedResourceDay", count: 1, date: "2026-08-24" },
        { severity: "Error", code: "ResponseError", count: 1, date: "2026-08-24" },
      ]),
    );
  });

  it("omits a conflicting raw identity and marks its date partial", () => {
    const regular = timetableEntry();
    const conflicting = timetableEntry({ status: "CANCELLED" });
    const plan = makeTimetableImportPlan(
      inventory([
        response([timetableDay(classOne, [regular, conflicting]), timetableDay(classTwo, [])]),
      ]),
    );

    expect(plan.snapshots[0]).toMatchObject({ completeness: "Partial", observations: [] });
    expect(plan.preview.days[0]?.diagnostics).toContainEqual({
      severity: "Error",
      code: "ConflictingEntryIdentity",
      count: 1,
      date: "2026-08-24",
    });
  });
});
