import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { DirectoryObservation } from "./directory-snapshot.ts";
import { projectDirectory, type DirectoryProjectionSourceRecord } from "./directory-projection.ts";
import { igsLilienthalProfile } from "./school-profile.ts";

const schoolNamed = (name: string) =>
  DirectoryObservation.make({
    _tag: "School",
    externalId: "6603700",
    payload: {
      name,
      loginName: "igs-lilienthal",
      hostName: "example.webuntis.com",
    },
  });

const school = schoolNamed("IGS Lilienthal");
const renamedSchool = schoolNamed("IGS Lilienthal Schule");

const year = (externalId: string, name: string, start: string, end: string) =>
  DirectoryObservation.make({
    _tag: "AcademicYear",
    externalId,
    payload: { name, start, end },
  });

const classGroup = (
  externalId: string,
  academicYearExternalId: string,
  name: string,
  teacherExternalId: string,
) =>
  DirectoryObservation.make({
    _tag: "ClassGroup",
    externalId,
    payload: {
      shortName: name,
      longName: "Teacher",
      displayName: name,
      academicYearExternalId,
      departmentExternalId: "1",
      classTeachers: {
        firstExternalId: teacherExternalId,
        secondExternalId: null,
      },
    },
  });

const teacher = DirectoryObservation.make({
  _tag: "Teacher",
  externalId: "11",
  payload: {
    shortName: "TCH",
    longName: "Teacher Name",
    displayName: "Teacher Name",
    departments: [
      {
        externalId: "1",
        shortName: "Sek I",
        longName: "Sekundarstufe I",
        displayName: "Sekundarstufe I",
      },
    ],
  },
});

const student = (classExternalId: string, name: string, start: string, end: string) =>
  DirectoryObservation.make({
    _tag: "Student",
    externalId: "21",
    payload: {
      shortName: "Student",
      longName: "Student Name",
      displayName: "Student Name",
      classes: [
        {
          class: {
            externalId: classExternalId,
            shortName: name,
            longName: name,
            displayName: name,
          },
          start,
          end,
          departmentExternalId: "1",
        },
      ],
    },
  });

const department = DirectoryObservation.make({
  _tag: "Department",
  externalId: "1",
  payload: {
    shortName: "Sek I",
    longName: "Sekundarstufe I",
    displayName: "Sekundarstufe I",
  },
});

const activity = DirectoryObservation.make({
  _tag: "Subject",
  externalId: "42",
  payload: {
    shortName: "MA2",
    longName: "Mathematik 2",
    displayName: "MA2",
    departments: [],
  },
});

const record = (
  scope: string,
  index: number,
  observation: DirectoryObservation,
): DirectoryProjectionSourceRecord => ({
  scope,
  sourceRecordVersionId: `version-${scope}-${index}`,
  observation,
});

describe("WebUntis directory projection", () => {
  it.effect("keeps one IGS class identity across annual WebUntis class IDs", () =>
    Effect.gen(function* () {
      const firstScope = "academic-year:4";
      const secondScope = "academic-year:6";
      const records = [
        ...[
          renamedSchool,
          year("6", "2024/2025", "2024-08-05", "2025-07-02"),
          department,
          classGroup("264", "6", "6.2", "11"),
          teacher,
          student("264", "6.2", "2024-08-05", "2025-07-02"),
        ].map((observation, index) => record(secondScope, index, observation)),
        ...[
          school,
          year("4", "2023/2024", "2023-08-17", "2024-07-03"),
          department,
          classGroup("133", "4", "5.2", "11"),
          teacher,
          student("133", "5.2", "2023-08-17", "2024-07-03"),
          activity,
        ].map((observation, index) => record(firstScope, index, observation)),
      ];

      const projected = yield* projectDirectory({
        dataSourceId: "webuntis:6603700",
        records,
      });

      const classGroups = projected.entities.filter((entity) => entity._tag === "ClassGroup");
      const placements = projected.entities.filter(
        (entity) => entity._tag === "ClassGroupAcademicYear",
      );
      expect(classGroups).toHaveLength(1);
      expect(projected.entities.find((entity) => entity._tag === "School")?.value.name).toBe(
        "IGS Lilienthal Schule",
      );
      expect(classGroups[0]?.id).toBe("igs-lilienthal/class/2023/2");
      expect(placements.map((entity) => entity.value.name)).toEqual(["5.2", "6.2"]);
      expect(placements.map((entity) => entity.value.gradeLevel)).toEqual([5, 6]);
      expect(projected.entities).toContainEqual(
        expect.objectContaining({
          _tag: "Cohort",
          id: "igs-lilienthal/cohort/2023",
          value: expect.objectContaining({ name: "Emmy" }),
        }),
      );
      expect(
        projected.entityLinks
          .filter((link) => link._tag === "ClassGroup")
          .map((link) => [link.source.externalId, link.classGroupId]),
      ).toEqual([
        ["133", "igs-lilienthal/class/2023/2"],
        ["264", "igs-lilienthal/class/2023/2"],
      ]);
      expect(
        projected.entities.filter((entity) => entity._tag === "StudentClassAssignment"),
      ).toHaveLength(2);
      expect(
        projected.entities.filter((entity) => entity._tag === "ClassTeacherAssignment"),
      ).toHaveLength(2);
      expect(
        projected.entities.filter((entity) => entity._tag === "ProviderActivity"),
      ).toHaveLength(1);
      expect(projected.entityLinks.some((link) => link._tag === "Subject")).toBe(false);
    }),
  );

  it("treats a newly appearing class suffix as a new class identity", () => {
    const first = igsLilienthalProfile.resolveClass({
      academicYearStart: 2024,
      shortName: "7.6",
    });
    const added = igsLilienthalProfile.resolveClass({
      academicYearStart: 2025,
      shortName: "8.7",
    });

    expect(first).toMatchObject({
      _tag: "ClassGroup",
      classGroupId: "igs-lilienthal/class/2022/6",
      gradeLevel: 7,
      cohortEntryAcademicYearStart: 2022,
    });
    expect(added).toMatchObject({
      _tag: "ClassGroup",
      classGroupId: "igs-lilienthal/class/2022/7",
      gradeLevel: 8,
      cohortEntryAcademicYearStart: 2022,
    });
  });

  it("does not pretend grade-wide timetable collections are classes", () => {
    expect(
      igsLilienthalProfile.resolveClass({ academicYearStart: 2026, shortName: "8" }),
    ).toMatchObject({ _tag: "Collection" });
  });
});
