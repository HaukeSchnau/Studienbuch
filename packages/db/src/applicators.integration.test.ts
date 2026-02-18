import { studentsOfUser } from "@stu/lib";
import { Cause, Effect, Exit } from "effect";
import { beforeAll, describe, expect, test, vi } from "vitest";

const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const courseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const school = "igs-lil";

const meta = (initiatorId: string) => ({ initiatorId }) as never;
const unsafe = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect as Effect.Effect<A, E, never>;

const loadDbModules = async () => {
  process.env.NODE_ENV = "test";
  process.env.MANAGEMENT_DATABASE_URL = process.env.MANAGEMENT_DATABASE_URL ?? "https://example.com";

  const [indexModule, studentRepoModule, gradeRepoModule, absenceRepoModule] = await Promise.all([
    import("./index"),
    import("./repositories/student.repo"),
    import("./repositories/grade.repo"),
    import("./repositories/absence.repo"),
  ]);

  return {
    applicators: indexModule.applicators,
    StudentRepository: studentRepoModule.StudentRepository,
    GradeRepositoryDb: gradeRepoModule.GradeRepositoryDb,
    AbsenceRepositoryDb: absenceRepoModule.AbsenceRepositoryDb,
  };
};

describe("db applicator tree integration", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.MANAGEMENT_DATABASE_URL = process.env.MANAGEMENT_DATABASE_URL ?? "https://example.com";
  });

  test("verify rejects disallowed student-scoped events through tree entrypoint", async () => {
    const { applicators } = await loadDbModules();
    const exit = await Effect.runPromiseExit(
      unsafe(
        applicators.verify(
          {
            type: "grades.currentGradeSet",
            data: {
              studentId,
              courseId,
              date: new Date("2026-01-02T00:00:00.000Z"),
              result: 2,
              type: "ORAL",
            },
          } as never,
          meta("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
        ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("NOT_ALLOWED");
    }
  });

  test("apply forwards grades.currentGradeSet to db grade repository through tree", async () => {
    const { applicators, StudentRepository, GradeRepositoryDb } = await loadDbModules();
    const setCurrentGrade = vi.fn(() => Effect.void);

    await Effect.runPromise(
      unsafe(
        applicators
          .apply(
            {
              type: "grades.currentGradeSet",
              data: {
                studentId,
                courseId,
                date: new Date("2026-01-02T00:00:00.000Z"),
                result: 2,
                type: "ORAL",
              },
            } as never,
            meta(studentId),
          )
          .pipe(
            Effect.provideService(StudentRepository, {
              doesClassExist: () => Effect.succeed(true),
              getSchoolOfUser: () => Effect.succeed(school),
              createStudent: () => Effect.void,
              doesCourseExist: () => Effect.succeed(true),
              isAssignedToCourse: () => Effect.succeed(false),
              assignCourse: () => Effect.void,
              getStudent: () =>
                Effect.succeed({
                  id: studentId,
                  firstName: "Ada",
                  lastName: "Lovelace",
                  school,
                  class: { identifier: "Q1", startYear: 2024 },
                  isOfAge: true,
                }),
            } as never),
            Effect.provideService(GradeRepositoryDb, {
              setCurrentGrade: setCurrentGrade,
              getLatestGradeDate: () => Effect.succeed(null),
              recordWrittenGrade: () => Effect.void,
              setTeacherSignature: () => Effect.void,
              setParentSignature: () => Effect.void,
              restoreLatest: () => Effect.void,
              discardGrade: () => Effect.void,
            } as never),
          ),
      ),
    );

    expect(setCurrentGrade).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId,
        courseId,
        isSignatureRequired: false,
      }),
    );
  });

  test("verify rejects stale current grades through tree", async () => {
    const { applicators, StudentRepository, GradeRepositoryDb } = await loadDbModules();
    const exit = await Effect.runPromiseExit(
      unsafe(
        applicators
          .verify(
            {
              type: "grades.currentGradeSet",
              data: {
                studentId,
                courseId,
                date: new Date("2026-01-02T00:00:00.000Z"),
                result: 2,
                type: "ORAL",
              },
            } as never,
            meta(studentId),
          )
          .pipe(
            Effect.provideService(StudentRepository, {
              doesClassExist: () => Effect.succeed(true),
              getSchoolOfUser: () => Effect.succeed(school),
              createStudent: () => Effect.void,
              doesCourseExist: () => Effect.succeed(true),
              isAssignedToCourse: () => Effect.succeed(false),
              assignCourse: () => Effect.void,
              getStudent: () =>
                Effect.succeed({
                  id: studentId,
                  firstName: "Ada",
                  lastName: "Lovelace",
                  school,
                  class: { identifier: "Q1", startYear: 2024 },
                  isOfAge: false,
                }),
            } as never),
            Effect.provideService(GradeRepositoryDb, {
              setCurrentGrade: () => Effect.void,
              getLatestGradeDate: () => Effect.succeed(new Date("2026-01-02T00:00:00.000Z")),
              recordWrittenGrade: () => Effect.void,
              setTeacherSignature: () => Effect.void,
              setParentSignature: () => Effect.void,
              restoreLatest: () => Effect.void,
              discardGrade: () => Effect.void,
            } as never),
          ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("GRADE_TOO_OLD");
    }
  });

  test("apply routes grades.parentApproved to db grade repository through tree", async () => {
    const { applicators, GradeRepositoryDb } = await loadDbModules();
    const setParentSignature = vi.fn(() => Effect.void);

    await Effect.runPromise(
      unsafe(
        applicators
          .apply(
            {
              type: "grades.parentApproved",
              data: {
                studentId,
                course: courseId,
                date: new Date("2026-01-04T00:00:00.000Z"),
                type: "WRITTEN",
                signature: "parent-signature",
              },
            } as never,
            meta(studentId),
          )
          .pipe(
            Effect.provideService(GradeRepositoryDb, {
              setCurrentGrade: () => Effect.void,
              getLatestGradeDate: () => Effect.succeed(null),
              recordWrittenGrade: () => Effect.void,
              setTeacherSignature: () => Effect.void,
              setParentSignature: setParentSignature,
              restoreLatest: () => Effect.void,
              discardGrade: () => Effect.void,
            } as never),
          ),
      ),
    );

    expect(setParentSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        course: courseId,
        type: "WRITTEN",
      }),
    );
  });

  test("apply routes absence.teacherApproved to db absence repository through tree", async () => {
    const { applicators, AbsenceRepositoryDb } = await loadDbModules();
    const setTeacherSignature = vi.fn(() => Effect.void);

    await Effect.runPromise(
      unsafe(
        applicators
          .apply(
            {
              type: "absence.teacherApproved",
              data: {
                studentId,
                date: new Date("2026-01-04T00:00:00.000Z"),
                courseId,
                signature: "teacher-signature",
              },
            } as never,
            meta(studentId),
          )
          .pipe(
            Effect.provideService(AbsenceRepositoryDb, {
              addAbsence: () => Effect.void,
              setParentSignature: () => Effect.void,
              setTeacherSignature: setTeacherSignature,
              deleteAbsence: () => Effect.void,
            } as never),
          ),
      ),
    );

    expect(setTeacherSignature).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId,
        signature: "teacher-signature",
      }),
    );
  });

  test("getEventTopics resolves student broadcast topic through tree", async () => {
    const { applicators } = await loadDbModules();
    const topics = await Effect.runPromise(
      unsafe(
        applicators.getEventTopics({
          type: "absence.recorded",
          data: {
            studentId,
            date: new Date("2026-01-02T00:00:00.000Z"),
            reason: "Krank",
            courseIds: [courseId],
          },
        } as never),
      ),
    );

    expect(topics).toEqual([studentsOfUser(studentId)]);
  });
});
