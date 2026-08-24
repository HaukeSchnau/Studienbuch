import { Importing, Organization, Schedule } from "@stu/core";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { projectCourseOfferings, type CourseOfferingAnchor } from "./course-offering-projection.ts";

const dataSourceId = Importing.DataSourceId.make("webuntis:school-1");
const schoolId = Organization.SchoolId.make("school-1");
const academicYearId = Organization.AcademicYearId.make("year-2026");

const source = (entityKind: Importing.ExternalEntityKind, externalId: string) =>
  Importing.SourceIdentity.make({
    dataSourceId,
    entityKind,
    externalId: Importing.ExternalId.make(externalId),
  });

const anchorValue = (anchor: CourseOfferingAnchor) =>
  anchor._tag === "ClassGroup"
    ? anchor.classGroupId
    : anchor._tag === "Teacher"
      ? anchor.teacherMembershipId
      : "unassigned";

const courseOfferingId = (input: {
  readonly academicYearId: Organization.AcademicYearId;
  readonly providerActivityExternalId: Importing.ExternalId;
  readonly anchor: CourseOfferingAnchor;
}) =>
  Organization.CourseOfferingId.make(
    `${input.academicYearId}/${input.providerActivityExternalId}/${input.anchor._tag}/${anchorValue(input.anchor)}`,
  );

const claim = (
  occurrenceId: string,
  type: "CLASS" | "SUBJECT" | "TEACHER",
  externalId: string,
  entityLink?: Importing.EntityLink,
) =>
  Schedule.ProviderOccurrenceClaim.make({
    source: source("TimetableOccurrence", `${type}:${externalId}:${occurrenceId}`),
    academicYear: {
      source: source("AcademicYear", "10"),
      entityLink: Importing.EntityLink.cases.AcademicYear.make({
        source: source("AcademicYear", "10"),
        academicYearId,
      }),
    },
    viewedResource: {
      source: source(
        type === "CLASS" ? "ClassGroup" : type === "SUBJECT" ? "Subject" : "Teacher",
        externalId,
      ),
      entityLink,
      type,
      status: "REGULAR",
      shortName: externalId,
      longName: type === "SUBJECT" ? `Subject ${externalId}` : externalId,
      displayName: type === "SUBJECT" ? `Subject ${externalId}` : externalId,
    },
    dayStatus: "REGULAR",
    location: "Grid",
    timeRange: Schedule.LocalTimeRange.Schema.make({
      start: Schedule.LocalTime.Schema.make(8 * 3_600_000),
      end: Schedule.LocalTime.Schema.make(9 * 3_600_000),
    }),
    type: "NORMAL_TEACHING_PERIOD",
    status: "REGULAR",
    resources: [],
    notes: "",
    icons: [],
    texts: [],
    lessonText: "",
    substitutionText: "",
    presentation: {
      color: "#ffffff",
      layoutStartPosition: 0,
      layoutWidth: 1,
      layoutGroup: 0,
    },
  });

const classLink = (externalId: string, classGroupId: string) =>
  Importing.EntityLink.cases.ClassGroup.make({
    source: source("ClassGroup", externalId),
    classGroupId: Organization.ClassGroupId.make(classGroupId),
  });

const teacherLink = (externalId: string, membershipId: string) =>
  Importing.EntityLink.cases.SchoolMembership.make({
    source: source("Teacher", externalId),
    schoolMembershipId: Organization.SchoolMembershipId.make(membershipId),
  });

const occurrence = (
  id: string,
  activityExternalId: string | undefined,
  classes: ReadonlyArray<readonly [externalId: string, classGroupId: string]>,
  teachers: ReadonlyArray<readonly [externalId: string, membershipId: string]> = [],
) => {
  const claims = [
    ...(activityExternalId === undefined ? [] : [claim(id, "SUBJECT", activityExternalId)]),
    ...classes.map(([externalId, classGroupId]) =>
      claim(id, "CLASS", externalId, classLink(externalId, classGroupId)),
    ),
    ...teachers.map(([externalId, membershipId]) =>
      claim(id, "TEACHER", externalId, teacherLink(externalId, membershipId)),
    ),
  ];
  const first = claims[0] ?? claim(id, "SUBJECT", "test-fallback");
  return Schedule.ProviderBackedOccurrence.make({
    id: Schedule.DatedOccurrenceId.make(id),
    dataSourceId,
    date: PlainDate.fromString("2026-08-24", Calendar.getBasic),
    providerEntryIds: [Importing.ExternalId.make(id)],
    courseOfferingIds: [],
    claims: [first, ...claims.slice(1)],
  });
};

describe("WebUntis course-offering projection", () => {
  it.effect("joins co-participating classes without merging separate class courses", () =>
    Effect.gen(function* () {
      const projection = yield* projectCourseOfferings({
        schoolId,
        courseOfferingId,
        occurrences: [
          occurrence("de-a-1", "DE", [["1", "class-a"]]),
          occurrence("de-a-2", "DE", [["1", "class-a"]]),
          occurrence("de-b", "DE", [["2", "class-b"]]),
          occurrence("wpk-bc", "WPK", [
            ["2", "class-b"],
            ["3", "class-c"],
          ]),
          occurrence("wpk-cd", "WPK", [
            ["3", "class-c"],
            ["4", "class-d"],
          ]),
        ],
      });

      expect(projection.offerings).toHaveLength(3);
      expect(
        projection.offerings.map((offering) => ({
          id: offering.id,
          classes: offering.classGroupIds,
          subjectId: offering.subjectId,
          termId: offering.termId,
        })),
      ).toEqual([
        {
          id: "year-2026/DE/ClassGroup/class-a",
          classes: ["class-a"],
          subjectId: undefined,
          termId: undefined,
        },
        {
          id: "year-2026/DE/ClassGroup/class-b",
          classes: ["class-b"],
          subjectId: undefined,
          termId: undefined,
        },
        {
          id: "year-2026/WPK/ClassGroup/class-b",
          classes: ["class-b", "class-c", "class-d"],
          subjectId: undefined,
          termId: undefined,
        },
      ]);
      expect(projection.unresolvedSubjectOfferings).toBe(3);
      expect(projection.evidence[2]?.occurrenceIds).toEqual(["wpk-bc", "wpk-cd"]);
    }),
  );

  it.effect("uses teacher identity only when no class identity exists", () =>
    Effect.gen(function* () {
      const projection = yield* projectCourseOfferings({
        schoolId,
        courseOfferingId,
        occurrences: [
          occurrence("upper-a-1", "EN", [], [["11", "teacher-a"]]),
          occurrence("upper-a-2", "EN", [], [["11", "teacher-a"]]),
          occurrence("upper-b", "EN", [], [["12", "teacher-b"]]),
        ],
      });

      expect(projection.offerings.map((offering) => offering.id)).toEqual([
        "year-2026/EN/Teacher/teacher-a",
        "year-2026/EN/Teacher/teacher-b",
      ]);
      expect(projection.evidence[0]?.teacherMembershipIds).toEqual(["teacher-a"]);
    }),
  );

  it.effect("keeps its anchor identity when later evidence expands a component", () =>
    Effect.gen(function* () {
      const initial = occurrence("wpk-ab", "WPK", [
        ["1", "class-a"],
        ["2", "class-b"],
      ]);
      const expanded = occurrence("wpk-bc", "WPK", [
        ["2", "class-b"],
        ["3", "class-c"],
      ]);
      const first = yield* projectCourseOfferings({
        schoolId,
        courseOfferingId,
        occurrences: [initial],
      });
      const second = yield* projectCourseOfferings({
        schoolId,
        courseOfferingId,
        occurrences: [initial, expanded],
      });

      expect(second.offerings[0]?.id).toBe(first.offerings[0]?.id);
      expect(second.offerings[0]?.classGroupIds).toEqual(["class-a", "class-b", "class-c"]);
    }),
  );

  it.effect("diagnoses occurrences that cannot identify an activity", () =>
    Effect.gen(function* () {
      const projection = yield* projectCourseOfferings({
        schoolId,
        courseOfferingId,
        occurrences: [occurrence("missing-subject", undefined, [["1", "class-a"]])],
      });

      expect(projection.offerings).toEqual([]);
      expect(projection.diagnostics).toEqual([{ code: "AmbiguousProviderActivity", count: 1 }]);
    }),
  );
});
