import { Importing, Schedule } from "@stu/core";
import { describe, expect, it } from "@effect/vitest";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import {
  makeCourseIdentityAudit,
  type CourseIdentityAuditPeriod,
} from "./course-identity-audit.ts";

const dataSourceId = Importing.DataSourceId.make("webuntis:school-1");

const source = (entityKind: Importing.ExternalEntityKind, externalId: string) =>
  Importing.SourceIdentity.make({
    dataSourceId,
    entityKind,
    externalId: Importing.ExternalId.make(externalId),
  });

const claim = (
  occurrenceId: string,
  academicYearExternalId: string,
  type: "CLASS" | "SUBJECT" | "TEACHER" | "ROOM",
  externalId: string,
  shortName: string,
  startHour: number,
  endHour: number,
) =>
  Schedule.ProviderOccurrenceClaim.make({
    source: source("TimetableOccurrence", `${type}:${externalId}:${occurrenceId}`),
    academicYear: { source: source("AcademicYear", academicYearExternalId) },
    viewedResource: {
      source: source(
        type === "CLASS"
          ? "ClassGroup"
          : type === "SUBJECT"
            ? "Subject"
            : type === "TEACHER"
              ? "Teacher"
              : "Room",
        externalId,
      ),
      type,
      shortName,
      longName: shortName,
      displayName: shortName,
    },
    dayStatus: "REGULAR",
    location: "Grid",
    timeRange: Schedule.LocalTimeRange.Schema.make({
      start: Schedule.LocalTime.Schema.make(startHour * 3_600_000),
      end: Schedule.LocalTime.Schema.make(endHour * 3_600_000),
    }),
    type: "NORMAL_TEACHING_PERIOD",
    status: "REGULAR",
    resources: [],
    notes: null,
    icons: [],
    texts: [],
    lessonText: null,
    substitutionText: null,
    presentation: {
      color: "#ffffff",
      layoutStartPosition: 0,
      layoutWidth: 1,
      layoutGroup: 0,
    },
  });

const occurrence = (input: {
  readonly id: string;
  readonly academicYearExternalId: string;
  readonly date: string;
  readonly activity: readonly [externalId: string, name: string];
  readonly classes: ReadonlyArray<readonly [externalId: string, shortName: string]>;
  readonly teacher?: string | undefined;
  readonly room?: string | undefined;
}) => {
  const activityClaim = claim(
    input.id,
    input.academicYearExternalId,
    "SUBJECT",
    input.activity[0],
    input.activity[1],
    8,
    9,
  );
  const claims = [
    activityClaim,
    ...input.classes.map(([externalId, shortName]) =>
      claim(input.id, input.academicYearExternalId, "CLASS", externalId, shortName, 8, 9),
    ),
    ...(input.teacher === undefined
      ? []
      : [
          claim(
            input.id,
            input.academicYearExternalId,
            "TEACHER",
            input.teacher,
            input.teacher,
            8,
            9,
          ),
        ]),
    ...(input.room === undefined
      ? []
      : [claim(input.id, input.academicYearExternalId, "ROOM", input.room, input.room, 8, 9)]),
  ];
  return Schedule.ProviderBackedOccurrence.make({
    id: Schedule.DatedOccurrenceId.make(input.id),
    dataSourceId,
    date: PlainDate.fromString(input.date, Calendar.getBasic),
    providerEntryIds: [Importing.ExternalId.make(input.id)],
    courseOfferingIds: [],
    claims: [activityClaim, ...claims.slice(1)],
  });
};

const periods = (): ReadonlyArray<CourseIdentityAuditPeriod> => [
  {
    academicYear: {
      externalId: "year-1",
      name: "2026/2027",
      start: "2026-08-01",
      end: "2027-07-31",
    },
    occurrences: [
      occurrence({
        id: "math-a",
        academicYearExternalId: "year-1",
        date: "2026-08-24",
        activity: ["activity-a", "Mathematik"],
        classes: [["class-8-1", "8.1"]],
        teacher: "teacher-1",
        room: "room-1",
      }),
      occurrence({
        id: "math-b",
        academicYearExternalId: "year-1",
        date: "2026-08-24",
        activity: ["activity-b", "Mathematik"],
        classes: [["class-8-1", "8.1"]],
        teacher: "teacher-1",
        room: "room-1",
      }),
      occurrence({
        id: "wpk-ab",
        academicYearExternalId: "year-1",
        date: "2026-08-25",
        activity: ["wpk", "WPK"],
        classes: [
          ["class-a", "8.1"],
          ["class-b", "8.2"],
        ],
      }),
      occurrence({
        id: "wpk-bc",
        academicYearExternalId: "year-1",
        date: "2026-08-26",
        activity: ["wpk", "WPK"],
        classes: [
          ["class-b", "8.2"],
          ["class-c", "8.3"],
        ],
      }),
      occurrence({
        id: "wpk-cd",
        academicYearExternalId: "year-1",
        date: "2026-08-27",
        activity: ["wpk", "WPK"],
        classes: [
          ["class-c", "8.3"],
          ["class-d", "8.4"],
        ],
      }),
    ],
  },
  {
    academicYear: {
      externalId: "year-2",
      name: "2027/2028",
      start: "2027-08-01",
      end: "2028-07-31",
    },
    occurrences: [
      occurrence({
        id: "math-next",
        academicYearExternalId: "year-2",
        date: "2027-08-24",
        activity: ["activity-c", "Mathematik"],
        classes: [["class-9-1", "9.1"]],
        teacher: "teacher-2",
      }),
    ],
  },
];

const makeAudit = (inputPeriods = periods()) =>
  makeCourseIdentityAudit({
    periods: inputPeriods,
    lastingClassIdentity: ({ shortName }) => {
      if (shortName === "8.1" || shortName === "9.1") return "lasting-class-1";
      return `lasting-${shortName}`;
    },
  });

describe("WebUntis course identity audit", () => {
  it("separates event collisions from risky course heuristics", () => {
    const audit = makeAudit();

    expect(audit.physicalConstraints.teacherOverlaps).toMatchObject({
      pairs: 1,
      regularTeachingPairs: 1,
      sameActivityPairs: 0,
      differentActivityPairs: 1,
    });
    expect(audit.physicalConstraints.roomOverlaps.pairs).toBe(1);
    expect(audit.activityEvidence.sameNameSharedClass.regularTeaching.pairs).toBe(1);
    expect(audit.activityEvidence.connectedClassRisk.regularTeaching).toMatchObject({
      nonIdenticalSignatureActivities: 1,
      singleClassOverlapActivities: 1,
      transitiveDisjointActivities: 1,
    });
  });

  it("reports ambiguous cross-year continuity without resolving it", () => {
    const audit = makeAudit();

    expect(audit.crossYearContinuity).toMatchObject({
      candidates: 2,
      sameProviderActivityId: 0,
      changedProviderActivityId: 2,
      ambiguousProfiles: 1,
    });
  });

  it("is independent of period and occurrence order", () => {
    const reversed = periods()
      .map((period) => ({ ...period, occurrences: [...period.occurrences].reverse() }))
      .reverse();

    expect(makeAudit(reversed)).toEqual(makeAudit());
  });

  it("does not treat school-profile collections as lasting classes", () => {
    const [firstPeriod] = periods();
    if (firstPeriod === undefined) return;
    const audit = makeCourseIdentityAudit({
      periods: [
        {
          ...firstPeriod,
          occurrences: [
            occurrence({
              id: "collection",
              academicYearExternalId: "year-1",
              date: "2026-08-24",
              activity: ["assembly", "Präsenz"],
              classes: [["grade-8", "8"]],
            }),
          ],
        },
      ],
      lastingClassIdentity: () => undefined,
    });

    expect(audit.activityEvidence.withoutClasses).toBe(1);
  });

  it("compares continuity only between adjacent academic years", () => {
    const nonAdjacent = periods().map((period, index) =>
      index === 1
        ? {
            ...period,
            academicYear: {
              ...period.academicYear,
              name: "2028/2029",
              start: "2028-08-01",
              end: "2029-07-31",
            },
          }
        : period,
    );

    expect(makeAudit(nonAdjacent).crossYearContinuity.candidates).toBe(0);
  });
});
