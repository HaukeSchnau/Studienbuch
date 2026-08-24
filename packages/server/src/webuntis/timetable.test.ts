import { Importing, Organization, Schedule } from "@stu/core";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type {
  DisplayResource,
  TimetableEntries,
  TimetableEntry,
  TimetableEntryDay,
  TimetableEntryPositionResource,
} from "webuntis-api";
import {
  makeTimetableImportPlan,
  projectTimetableOccurrences,
  type TimetableInventory,
} from "./timetable.ts";

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
  school: {
    externalId: "school-1",
    name: "Test School",
    loginName: "test-school",
  },
  academicYear: {
    id: 10,
    name: "2026/2027",
    dateRange: { start: "2026-08-13", end: "2027-07-07" },
  },
  requestedRange: { start: "2026-08-24", end: "2026-08-24" },
  requestedDates: ["2026-08-24"],
  resources: {
    CLASS: [classOne, classTwo],
    SUBJECT: [],
    TEACHER: [],
    ROOM: [],
  },
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
      resourceCounts: { CLASS: 2, SUBJECT: 0, TEACHER: 0, ROOM: 0 },
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
      expectedResourceRows: 2,
      returnedResourceRows: 2,
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

  it("preserves a null primary position from historical timetable entries", () => {
    const plan = makeTimetableImportPlan(
      inventory([
        response([
          timetableDay(classOne, [timetableEntry({ position1: null })]),
          timetableDay(classTwo, []),
        ]),
      ]),
    );

    expect(plan.snapshots[0]?.observations[0]?.payload.entry.position1).toBeNull();
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

  it.effect("merges resource views into one occurrence without choosing between their claims", () =>
    Effect.gen(function* () {
      const removedTeacher = positionResource("TEACHER", "REMOVED", "Teacher old");
      const addedTeacher = positionResource("TEACHER", "ADDED", "Teacher new");
      const firstView = timetableEntry({
        status: "CHANGED",
        notesAll: "Bring the workbook",
        icons: ["NOTES"],
        position1: [{ current: addedTeacher, removed: removedTeacher }],
        position2: [{ current: positionResource("SUBJECT", "REGULAR", "Math"), removed: null }],
        position3: [{ current: null, removed: positionResource("ROOM", "REMOVED", "Room 1") }],
        position4: [{ current: null, removed: null }],
        texts: [{ type: "INFO", text: "Room moved" }],
        lessonText: "Chapter 4",
        lessonInfo: "Internal lesson info",
        substitutionText: "Replacement teacher",
      });
      const secondView = timetableEntry({
        ids: [101, 102],
        duration: { start: "09:00", end: "09:45" },
        status: "CANCELLED",
      });
      const subject = resource(3, "Math");
      const teacher = resource(4, "Teacher new");
      const room = resource(5, "Room 2");
      const nullableRoomView = timetableEntry({
        notesAll: null,
        lessonText: null,
        substitutionText: null,
      });
      const plan = makeTimetableImportPlan(
        inventory(
          [
            response([
              timetableDay(classTwo, [secondView]),
              timetableDay(classOne, [firstView]),
              timetableDay(subject, [timetableEntry()], { resourceType: "SUBJECT" }),
              timetableDay(teacher, [timetableEntry()], { resourceType: "TEACHER" }),
              timetableDay(room, [nullableRoomView], { resourceType: "ROOM" }),
            ]),
          ],
          {
            resources: {
              CLASS: [classOne, classTwo],
              SUBJECT: [subject],
              TEACHER: [teacher],
              ROOM: [room],
            },
          },
        ),
      );
      const dataSourceId = Importing.DataSourceId.make(plan.preview.dataSourceId);
      const academicYearSource = Importing.SourceIdentity.make({
        dataSourceId,
        entityKind: "AcademicYear",
        externalId: Importing.ExternalId.make("10"),
      });
      const classSource = Importing.SourceIdentity.make({
        dataSourceId,
        entityKind: "ClassGroup",
        externalId: Importing.ExternalId.make("1"),
      });
      const teacherSource = Importing.SourceIdentity.make({
        dataSourceId,
        entityKind: "Teacher",
        externalId: Importing.ExternalId.make("4"),
      });
      const roomSource = Importing.SourceIdentity.make({
        dataSourceId,
        entityKind: "Room",
        externalId: Importing.ExternalId.make("5"),
      });
      const entityLinks = [
        Importing.EntityLink.cases.AcademicYear.make({
          source: academicYearSource,
          academicYearId: Organization.AcademicYearId.make("year-2026"),
        }),
        Importing.EntityLink.cases.ClassGroup.make({
          source: classSource,
          classGroupId: Organization.ClassGroupId.make("paula-1"),
        }),
        Importing.EntityLink.cases.SchoolMembership.make({
          source: teacherSource,
          schoolMembershipId: Organization.SchoolMembershipId.make("teacher-4"),
        }),
        Importing.EntityLink.cases.Room.make({
          source: roomSource,
          roomId: Organization.RoomId.make("room-5"),
        }),
      ];
      const occurrences = yield* projectTimetableOccurrences({
        dataSourceId,
        observations: plan.snapshots.flatMap((snapshot) => snapshot.observations),
        entityLinks,
      });
      const reordered = yield* projectTimetableOccurrences({
        dataSourceId,
        observations: plan.snapshots.flatMap((snapshot) => [...snapshot.observations].reverse()),
        entityLinks,
      });

      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]?.id).toBe(reordered[0]?.id);
      expect(occurrences[0]?.providerEntryIds).toEqual(["101", "102"]);
      expect(occurrences[0]?.claims).toHaveLength(5);
      expect(occurrences[0]?.claims.map((claim) => claim.status)).toEqual([
        "CHANGED",
        "CANCELLED",
        "REGULAR",
        "REGULAR",
        "REGULAR",
      ]);
      expect(
        occurrences[0]?.claims.map((claim) => Schedule.LocalTime.hour(claim.timeRange.start)),
      ).toEqual([8, 9, 8, 8, 8]);
      expect(occurrences[0]?.claims[0]).toMatchObject({
        source: { entityKind: "TimetableOccurrence" },
        academicYear: {
          source: { entityKind: "AcademicYear", externalId: "10" },
          entityLink: { _tag: "AcademicYear", academicYearId: "year-2026" },
        },
        viewedResource: {
          source: { entityKind: "ClassGroup", externalId: "1" },
          entityLink: { _tag: "ClassGroup", classGroupId: "paula-1" },
          type: "CLASS",
        },
        notes: "Bring the workbook",
        texts: [{ type: "INFO", text: "Room moved" }],
        lessonInfo: "Internal lesson info",
        resources: [
          { _tag: "Replaced", position: 1 },
          { _tag: "Current", position: 2 },
          { _tag: "Removed", position: 3 },
          { _tag: "Empty", position: 4 },
        ],
      });
      expect(occurrences[0]?.claims[1]?.viewedResource.entityLink).toBeUndefined();
      expect(
        Object.fromEntries(
          occurrences[0]?.claims.map((claim) => [
            claim.viewedResource.type,
            {
              sourceKind: claim.viewedResource.source?.entityKind,
              linkTag: claim.viewedResource.entityLink?._tag,
            },
          ]) ?? [],
        ),
      ).toMatchObject({
        CLASS: { sourceKind: "ClassGroup" },
        SUBJECT: { sourceKind: "Subject", linkTag: undefined },
        TEACHER: { sourceKind: "Teacher", linkTag: "SchoolMembership" },
        ROOM: { sourceKind: "Room", linkTag: "Room" },
      });
      expect(
        occurrences[0]?.claims.find((claim) => claim.viewedResource.type === "ROOM"),
      ).toMatchObject({ notes: null, lessonText: null, substitutionText: null });
    }),
  );

  it.effect("reports invalid provider times in the Effect error channel", () =>
    Effect.gen(function* () {
      const invalid = timetableEntry({ duration: { start: "tomorrow", end: "09:30" } });
      const plan = makeTimetableImportPlan(
        inventory([response([timetableDay(classOne, [invalid]), timetableDay(classTwo, [])])]),
      );
      const failure = yield* projectTimetableOccurrences({
        dataSourceId: Importing.DataSourceId.make(plan.preview.dataSourceId),
        observations: plan.snapshots.flatMap((snapshot) => snapshot.observations),
      }).pipe(Effect.flip);

      expect(failure).toMatchObject({
        _tag: "WebUntis.InvalidTimetableOccurrence",
        field: "StartTime",
        value: "tomorrow",
      });
    }),
  );

  it.effect("accepts WebUntis local date-time strings without discarding their raw form", () =>
    Effect.gen(function* () {
      const dated = timetableEntry({
        duration: { start: "2026-08-24T08:00", end: "2026-08-24T09:30" },
      });
      const plan = makeTimetableImportPlan(
        inventory([response([timetableDay(classOne, [dated]), timetableDay(classTwo, [])])]),
      );
      const occurrences = yield* projectTimetableOccurrences({
        dataSourceId: Importing.DataSourceId.make(plan.preview.dataSourceId),
        observations: plan.snapshots.flatMap((snapshot) => snapshot.observations),
      });

      expect(
        occurrences.map((occurrence) =>
          Schedule.LocalTime.hour(occurrence.claims[0].timeRange.start),
        ),
      ).toEqual([8]);
      expect(plan.snapshots[0]?.observations[0]?.payload.entry.duration.start).toBe(
        "2026-08-24T08:00",
      );
    }),
  );
});
