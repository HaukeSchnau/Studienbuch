import { describe, expect, it } from "@effect/vitest";
import { runCrypto } from "../cryptography/testing.ts";
import type {
  AppData,
  DisplayResource,
  Schoolyear,
  TimetableFilter,
  TimetableResourceType,
} from "webuntis-api";
import { summarizeDirectoryInventory } from "./directory-preview.ts";
import { makeDirectorySnapshot } from "./directory-snapshot.ts";

const resource = (id: number, name: string): DisplayResource => ({
  id,
  shortName: name,
  longName: name,
  displayName: name,
});

const academicYear: Schoolyear = {
  id: 10,
  name: "2026/2027",
  dateRange: { start: "2026-08-13", end: "2027-07-07" },
};

const appData: AppData = {
  departments: [],
  currentSchoolYear: {
    ...academicYear,
    timeGrid: {
      schoolyearId: academicYear.id,
      units: [
        { unitOfDay: 1, startTime: 740, endTime: 825 },
        { unitOfDay: 2, startTime: 825, endTime: 910 },
      ],
    },
  },
  tenant: { displayName: "School", id: "tenant-1", name: "school" },
  user: {
    id: 1,
    locale: "de_DE",
    name: "importer",
    email: null,
    permissions: { views: [] },
    roles: [],
  },
  permissions: [],
  settings: [],
  holidays: [
    {
      id: 100,
      name: "Summer",
      start: "2026-07-01",
      end: "2026-08-16",
      bookable: false,
    },
    {
      id: 101,
      name: "Old holiday",
      start: "2025-01-01",
      end: "2025-01-01",
      bookable: false,
    },
  ],
};

const filter = (resourceType: TimetableResourceType): TimetableFilter => ({
  resourceType,
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
});

const baseInventory = (): Parameters<typeof summarizeDirectoryInventory>[0] => {
  const department = resource(1, "Department");
  const classResource = resource(1, "Class");
  const teacher = resource(1, "Teacher");
  return {
    appData,
    academicYear,
    classFilter: {
      ...filter("CLASS"),
      departments: [department],
      classes: [
        {
          class: classResource,
          classTeacher1: teacher,
          classTeacher2: null,
          department: null,
        },
      ],
    },
    roomFilter: {
      ...filter("ROOM"),
      departments: [department],
      rooms: [
        {
          room: resource(1, "Room"),
          capacity: 20,
          roomGroups: [],
          building: resource(1, "Building"),
          department,
        },
      ],
    },
    studentFilter: {
      ...filter("STUDENT"),
      departments: [department],
      students: [
        {
          student: resource(1, "Student"),
          classes: [
            {
              class: classResource,
              dateRange: academicYear.dateRange,
              department,
            },
          ],
          assignmentGroups: [],
          imageUrl: null,
        },
      ],
    },
    subjectFilter: {
      ...filter("SUBJECT"),
      departments: [department],
      subjects: [{ subject: resource(1, "Activity"), departments: [department] }],
    },
    teacherFilter: {
      ...filter("TEACHER"),
      departments: [department],
      teachers: [{ teacher, departments: [department], imageUrl: null }],
    },
  };
};

describe("WebUntis directory preview", () => {
  it("keeps equal numeric IDs distinct across provider entity kinds", () => {
    const preview = summarizeDirectoryInventory(baseInventory());

    expect(preview.ready).toBe(true);
    expect(preview.wouldImport).toMatchObject({
      schools: 1,
      academicYears: 1,
      departments: 1,
      buildings: 1,
      rooms: 1,
      classes: 1,
      teachers: 1,
      students: 1,
      activities: 1,
      holidays: 1,
      bellPeriods: 2,
    });
    expect(preview.diagnostics).toContainEqual({
      severity: "Warning",
      code: "ClassWithoutDepartment",
      count: 1,
    });
    expect(preview.diagnostics.some((item) => item.code === "DuplicateExternalIdentity")).toBe(
      false,
    );
  });

  it("normalizes a stable, image-free observation generation", () => {
    const inventory = baseInventory();
    const first = runCrypto(makeDirectorySnapshot(inventory));
    const reordered = runCrypto(
      makeDirectorySnapshot({
        ...inventory,
        teacherFilter: {
          ...inventory.teacherFilter,
          departments: [...inventory.teacherFilter.departments].reverse(),
        },
        studentFilter: {
          ...inventory.studentFilter,
          students: [...inventory.studentFilter.students].reverse(),
        },
      }),
    );

    expect(first.observations).toHaveLength(12);
    expect(first.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(reordered.contentHash).toBe(first.contentHash);
    expect(JSON.stringify(first.observations)).not.toContain("imageUrl");
    expect(first.observations).toContainEqual({
      _tag: "BellPeriod",
      externalId: "2",
      payload: { unitOfDay: 2, startTime: 825, endTime: 910 },
    });
  });

  it("blocks apply readiness when source identities or references are inconsistent", () => {
    const base = baseInventory();
    const firstClass = base.classFilter.classes[0];
    const firstStudent = base.studentFilter.students[0];
    expect(firstClass).toBeDefined();
    expect(firstStudent).toBeDefined();
    if (firstClass === undefined || firstStudent === undefined) return;
    const inventory: Parameters<typeof summarizeDirectoryInventory>[0] = {
      ...base,
      classFilter: {
        ...base.classFilter,
        classes: [
          ...base.classFilter.classes,
          {
            class: firstClass.class,
            classTeacher1: resource(999, "Unknown teacher"),
            classTeacher2: null,
            department: resource(999, "Unknown department"),
          },
        ],
      },
      studentFilter: {
        ...base.studentFilter,
        students: [
          {
            ...firstStudent,
            classes: [
              ...firstStudent.classes,
              {
                class: resource(999, "Unknown class"),
                dateRange: academicYear.dateRange,
                department: null,
              },
            ],
          },
        ],
      },
    };

    const preview = summarizeDirectoryInventory(inventory);

    expect(preview.ready).toBe(false);
    expect(preview.diagnostics).toEqual(
      expect.arrayContaining([
        { severity: "Error", code: "DuplicateExternalIdentity", count: 1 },
        { severity: "Error", code: "UnknownClassReference", count: 1 },
        { severity: "Error", code: "UnknownTeacherReference", count: 1 },
        { severity: "Error", code: "UnknownDepartmentReference", count: 1 },
      ]),
    );
  });
});
