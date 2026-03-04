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

  const [gradesModule, absenceModule, studentModule, studentRepoModule, gradeRepoModule, absenceRepoModule] =
    await Promise.all([
      import("./grades"),
      import("./absence"),
      import("./student"),
      import("../repositories/student.repo"),
      import("../repositories/grade.repo"),
      import("../repositories/absence.repo"),
    ]);

  return {
    gradeApplicators: gradesModule.gradeApplicators,
    absenceApplicators: absenceModule.absenceApplicators,
    studentApplicators: studentModule.studentApplicators,
    StudentRepository: studentRepoModule.StudentRepository,
    GradeRepositoryDb: gradeRepoModule.GradeRepositoryDb,
    AbsenceRepositoryDb: absenceRepoModule.AbsenceRepositoryDb,
  };
};

describe("student scoped applicators (db package)", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";
    process.env.MANAGEMENT_DATABASE_URL = process.env.MANAGEMENT_DATABASE_URL ?? "https://example.com";
  });

  test("grades.currentGradeSet.verify rejects when initiator is not student", async () => {
    const { gradeApplicators } = await loadDbModules();
    const exit = await Effect.runPromiseExit(
      unsafe(
        gradeApplicators.currentGradeSet!.verify(
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
  }, 15_000);

  test("grades.currentGradeSet.apply forwards signature requirement from student age", async () => {
    const { gradeApplicators, StudentRepository, GradeRepositoryDb } = await loadDbModules();
    const setCurrentGrade = vi.fn(() => Effect.void);

    await Effect.runPromise(
      unsafe(
        gradeApplicators
          .currentGradeSet!.apply(
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
                  school: school,
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

  test("absence.recorded.apply forwards signature requirement from student age", async () => {
    const { absenceApplicators, StudentRepository, AbsenceRepositoryDb } = await loadDbModules();
    const addAbsence = vi.fn(() => Effect.void);

    await Effect.runPromise(
      unsafe(
        absenceApplicators
          .recorded!.apply(
            {
              type: "absence.recorded",
              data: {
                studentId,
                date: new Date("2026-01-02T00:00:00.000Z"),
                reason: "Krank",
                courseIds: [courseId],
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
                  school: school,
                  class: { identifier: "Q1", startYear: 2024 },
                  isOfAge: false,
                }),
            } as never),
            Effect.provideService(AbsenceRepositoryDb, {
              addAbsence: addAbsence,
              setParentSignature: () => Effect.void,
              setTeacherSignature: () => Effect.void,
              deleteAbsence: () => Effect.void,
            } as never),
          ),
      ),
    );

    expect(addAbsence).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId,
        isSignatureRequired: true,
      }),
    );
  });

  test("student.joined.apply splits first and last name", async () => {
    const { studentApplicators, StudentRepository } = await loadDbModules();
    const createStudent = vi.fn(() => Effect.void);

    await Effect.runPromise(
      unsafe(
        studentApplicators
          .joined!.apply(
            {
              type: "student.joined",
              data: {
                studentId,
                name: "Ada Lovelace Byron",
                school: school,
                isOfAge: false,
                class: { identifier: "Q1", startYear: 2024 },
              },
            } as never,
            meta(studentId),
          )
          .pipe(
            Effect.provideService(StudentRepository, {
              doesClassExist: () => Effect.succeed(true),
              getSchoolOfUser: () => Effect.succeed(school),
              createStudent: createStudent,
              doesCourseExist: () => Effect.succeed(true),
              isAssignedToCourse: () => Effect.succeed(false),
              assignCourse: () => Effect.void,
              getStudent: () =>
                Effect.succeed({
                  id: studentId,
                  firstName: "Ada",
                  lastName: "Lovelace",
                  school: school,
                  class: { identifier: "Q1", startYear: 2024 },
                  isOfAge: false,
                }),
            } as never),
          ),
      ),
    );

    expect(createStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace Byron",
      }),
    );
  });
});
