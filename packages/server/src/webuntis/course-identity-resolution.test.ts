import { describe, expect, it } from "@effect/vitest";
import {
  AnnualCourseObservation,
  AnnualCourseConstructionEvidence,
} from "./course-reconciliation.ts";
import { resolveCourseIdentities } from "./course-identity-resolution.ts";
import { igsLilienthalProfile } from "./school-profile.ts";

const annual = (input: {
  readonly id: string;
  readonly year: string;
  readonly students: readonly [string, ...Array<string>];
  readonly group: string;
  readonly code?: string | undefined;
}) =>
  AnnualCourseObservation.make({
    id: input.id,
    academicYearExternalId: input.year,
    courseCodes: input.code === undefined ? [] : [input.code],
    activityExternalIds: [],
    teacherExternalIds: [],
    classExternalIds: [],
    studentExternalIds: input.students,
    rosterPartitions: [{ schoolGroupKey: input.group, studentExternalIds: input.students }],
    datedObservationIds: [`${input.id}/1`, `${input.id}/2`, `${input.id}/3`],
    construction: AnnualCourseConstructionEvidence.make({
      _tag: "RepeatedRoster",
      regularOccurrences: 3,
    }),
  });

const policy = igsLilienthalProfile.courseReconciliation;

describe("WebUntis course identity resolution", () => {
  it("allocates one opaque identity for a stable component spanning academic years", () => {
    const result = resolveCourseIdentities({
      periods: [
        {
          academicYearExternalId: "2025",
          startsOn: "2025-08-01",
          observations: [
            annual({
              id: "previous",
              year: "2025",
              students: ["a", "b", "c", "d", "f"],
              group: "ClassGroup:stable",
              code: "MA-E",
            }),
          ],
        },
        {
          academicYearExternalId: "2026",
          startsOn: "2026-08-01",
          observations: [
            annual({
              id: "current",
              year: "2026",
              students: ["a", "b", "c", "d", "e"],
              group: "ClassGroup:stable",
              code: "MA-E",
            }),
          ],
        },
      ],
      existingAssignments: [],
      policy,
    });

    expect(result.decisions.map((decision) => decision._tag)).toEqual(["Same"]);
    expect(result.assignments).toEqual([
      {
        _tag: "Start",
        anchorObservationId: "previous",
        annualObservationIds: ["previous", "current"],
      },
    ]);
  });

  it("reuses a stored identity in either chronological direction", () => {
    const previous = annual({
      id: "previous",
      year: "2025",
      students: ["a", "b", "c", "d", "f"],
      group: "ClassGroup:stable",
      code: "MA-E",
    });
    const current = annual({
      id: "current",
      year: "2026",
      students: ["a", "b", "c", "d", "e"],
      group: "ClassGroup:stable",
      code: "MA-E",
    });

    const result = resolveCourseIdentities({
      periods: [
        { academicYearExternalId: "2025", startsOn: "2025-08-01", observations: [previous] },
        { academicYearExternalId: "2026", startsOn: "2026-08-01", observations: [current] },
      ],
      existingAssignments: [{ annualObservationId: "current", courseOfferingId: "course-1" }],
      policy,
    });

    expect(result.assignments).toEqual([
      { _tag: "Reuse", annualObservationId: "current", courseOfferingId: "course-1" },
      { _tag: "Reuse", annualObservationId: "previous", courseOfferingId: "course-1" },
    ]);
  });

  it("does not allocate identities for competing roster variants in one year", () => {
    const result = resolveCourseIdentities({
      periods: [
        {
          academicYearExternalId: "2026",
          startsOn: "2026-08-01",
          observations: [
            annual({
              id: "variant-a",
              year: "2026",
              students: ["a", "b", "c", "d"],
              group: "ClassGroup:stable",
              code: "MA-E",
            }),
            annual({
              id: "variant-b",
              year: "2026",
              students: ["a", "b", "c", "e"],
              group: "ClassGroup:stable",
              code: "MA-E",
            }),
          ],
        },
      ],
      existingAssignments: [],
      policy,
    });

    expect(result.assignments).toEqual([
      {
        _tag: "Unresolved",
        annualObservationId: "variant-a",
        reason: "CompetingSameYearPattern",
      },
      {
        _tag: "Unresolved",
        annualObservationId: "variant-b",
        reason: "CompetingSameYearPattern",
      },
    ]);
  });
});
