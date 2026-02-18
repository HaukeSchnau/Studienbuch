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

  const [indexModule, studentRepoModule, gradeRepoModule] = await Promise.all([
    import("./index"),
    import("./repositories/student.repo"),
    import("./repositories/grade.repo"),
  ]);

  return {
    applicators: indexModule.applicators,
    StudentRepository: studentRepoModule.StudentRepository,
    GradeRepositoryDb: gradeRepoModule.GradeRepositoryDb,
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
