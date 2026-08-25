import { describe, expect, it } from "@effect/vitest";
import {
  AnnualCourseObservation,
  buildAnnualCourseObservations,
  reconcileAnnualCourseObservations,
} from "./course-reconciliation.ts";
import { igsLilienthalProfile } from "./school-profile.ts";
import { CourseRosterMember, CourseRosterObservation } from "./student-timetable.ts";

const policy = igsLilienthalProfile.courseReconciliation;

const roster = (input: {
  readonly year: string;
  readonly date: string;
  readonly entryId: string;
  readonly code: string;
  readonly students: readonly [string, ...Array<string>];
  readonly schoolGroupKey: string;
  readonly teacher?: string | undefined;
  readonly activity?: string | undefined;
}) => {
  const [firstStudent, ...otherStudents] = input.students;
  const member = (studentExternalId: string) =>
    CourseRosterMember.make({
      studentExternalId,
      classExternalIds: [],
      schoolGroupKeys: [input.schoolGroupKey],
    });
  return CourseRosterObservation.make({
    id: `${input.year}/${input.date}/${input.entryId}`,
    academicYearExternalId: input.year,
    date: input.date,
    providerEntryIds: [input.entryId],
    sourceExternalIds: [
      `STUDENT:${firstStudent}:${input.date}:${input.entryId}`,
      ...otherStudents.map((student) => `STUDENT:${student}:${input.date}:${input.entryId}`),
    ],
    timeRanges: ["08:00/09:30"],
    courseCodes: [input.code],
    activityExternalIds: [input.activity ?? `${input.code}-activity`],
    teacherExternalIds: input.teacher === undefined ? [] : [input.teacher],
    classExternalIds: [],
    members: [member(firstStudent), ...otherStudents.map(member)],
    regularTeaching: true,
  });
};

const repeated = (input: Omit<Parameters<typeof roster>[0], "date" | "entryId">) =>
  ["09-01", "09-08", "09-15"].map((monthDay, index) =>
    roster({
      ...input,
      date: `${input.year === "year-1" ? "2025" : "2026"}-${monthDay}`,
      entryId: `${input.code}-${input.schoolGroupKey}-${index}`,
    }),
  );

describe("WebUntis course reconciliation", () => {
  it("keeps parallel MA-E groups separate even with the same teacher and activity", () => {
    const dated = [
      ...repeated({
        year: "year-2",
        code: "MA-E",
        students: ["a1", "a2", "a3", "a4"],
        schoolGroupKey: "ClassGroup:2023/1",
        teacher: "teacher-1",
        activity: "math-e",
      }),
      ...repeated({
        year: "year-2",
        code: "MA-E",
        students: ["b1", "b2", "b3", "b4"],
        schoolGroupKey: "ClassGroup:2023/1",
        teacher: "teacher-1",
        activity: "math-e",
      }),
    ];

    const built = buildAnnualCourseObservations(dated, policy);

    expect(built.observations).toHaveLength(2);
    expect(built.observations.map((item) => item.studentExternalIds)).toEqual([
      ["a1", "a2", "a3", "a4"],
      ["b1", "b2", "b3", "b4"],
    ]);
    expect(buildAnnualCourseObservations([...dated].reverse(), policy)).toEqual(built);
  });

  it("continues a course across years when its roster progresses and its teacher changes", () => {
    const previous = buildAnnualCourseObservations(
      repeated({
        year: "year-1",
        code: "MA-E",
        students: ["a", "b", "c", "d", "e"],
        schoolGroupKey: "ClassGroup:2022/1",
        teacher: "teacher-old",
        activity: "activity-old",
      }),
      policy,
    ).observations;
    const current = buildAnnualCourseObservations(
      repeated({
        year: "year-2",
        code: "MA-E",
        students: ["a", "b", "c", "d", "f"],
        schoolGroupKey: "ClassGroup:2022/1",
        teacher: "teacher-new",
        activity: "activity-new",
      }),
      policy,
    ).observations;

    expect(reconcileAnnualCourseObservations(previous, current, policy)).toMatchObject([
      {
        _tag: "Same",
        evidence: {
          sharedTeacherExternalIds: [],
          sharedActivityExternalIds: [],
          sharedCourseCodes: ["MA-E"],
          strongRosterContinuity: true,
          roster: { sharedStudents: 4, unionStudents: 6 },
        },
      },
    ]);
  });

  it("combines recurring MA23 cohort rows and compares only the continuing cohort", () => {
    const previous = buildAnnualCourseObservations(
      [
        ...repeated({
          year: "year-1",
          code: "MA23",
          students: ["old-1", "old-2", "old-3", "old-4", "old-5", "old-6", "old-7"],
          schoolGroupKey: "CohortEntry:2012",
          teacher: "teacher-1",
          activity: "ma23-old",
        }),
        ...repeated({
          year: "year-1",
          code: "MA23",
          students: ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"],
          schoolGroupKey: "CohortEntry:2013",
          teacher: "teacher-1",
          activity: "ma23-old",
        }),
      ],
      policy,
    ).observations;
    const current = buildAnnualCourseObservations(
      [
        ...repeated({
          year: "year-2",
          code: "MA23",
          students: ["s1", "s2", "s3", "s4", "s5", "s6", "joined"],
          schoolGroupKey: "CohortEntry:2013",
          teacher: "teacher-2",
          activity: "ma23-new",
        }),
        ...repeated({
          year: "year-2",
          code: "MA23",
          students: ["new-1", "new-2", "new-3", "new-4", "new-5", "new-6", "new-7"],
          schoolGroupKey: "CohortEntry:2014",
          teacher: "teacher-2",
          activity: "ma23-new",
        }),
      ],
      policy,
    ).observations;

    expect(previous).toHaveLength(1);
    expect(current).toHaveLength(1);
    expect(previous[0]?.construction).toMatchObject({
      _tag: "RepeatedJointRows",
      simultaneousOccurrences: 3,
    });
    expect(reconcileAnnualCourseObservations(previous, current, policy)).toMatchObject([
      {
        _tag: "Same",
        evidence: {
          sharedSchoolGroupKeys: ["CohortEntry:2013"],
          roster: {
            leftStudents: 8,
            rightStudents: 7,
            sharedStudents: 6,
            unionStudents: 9,
          },
        },
      },
    ]);
  });

  it("does not turn a one-off joint lesson into a permanent merge", () => {
    const first = repeated({
      year: "year-2",
      code: "MA-E",
      students: ["a", "b", "c", "d"],
      schoolGroupKey: "ClassGroup:2023/1",
      teacher: "teacher-1",
    });
    const second = repeated({
      year: "year-2",
      code: "MA-E",
      students: ["e", "f", "g", "h"],
      schoolGroupKey: "ClassGroup:2023/2",
      teacher: "teacher-2",
    });
    const joint = roster({
      year: "year-2",
      date: "2026-10-01",
      entryId: "joint-once",
      code: "MA-E",
      students: ["a", "b", "c", "d", "e", "f", "g", "h"],
      schoolGroupKey: "ClassGroup:2023/1",
      teacher: "teacher-1",
    });

    const built = buildAnnualCourseObservations([...first, ...second, joint], policy);

    expect(built.observations).toHaveLength(2);
    expect(built.unresolvedDatedObservationIds).toEqual([joint.id]);
  });

  it("reports competing strong continuations as ambiguous", () => {
    const [previous] = buildAnnualCourseObservations(
      repeated({
        year: "year-1",
        code: "MA-E",
        students: ["a", "b", "c", "d", "e"],
        schoolGroupKey: "ClassGroup:2022/1",
      }),
      policy,
    ).observations;
    const [current] = buildAnnualCourseObservations(
      repeated({
        year: "year-2",
        code: "MA-E",
        students: ["a", "b", "c", "d", "f"],
        schoolGroupKey: "ClassGroup:2022/1",
      }),
      policy,
    ).observations;
    if (previous === undefined || current === undefined) return;
    const competing = AnnualCourseObservation.make({
      id: `${current.id}/competing`,
      academicYearExternalId: current.academicYearExternalId,
      courseCodes: current.courseCodes,
      activityExternalIds: current.activityExternalIds,
      teacherExternalIds: current.teacherExternalIds,
      classExternalIds: current.classExternalIds,
      studentExternalIds: current.studentExternalIds,
      rosterPartitions: current.rosterPartitions,
      datedObservationIds: current.datedObservationIds,
      construction: current.construction,
    });

    expect(
      reconcileAnnualCourseObservations([previous], [current, competing], policy).map(
        (decision) => decision._tag,
      ),
    ).toEqual(["Ambiguous", "Ambiguous"]);
  });
});
