import { ClassRepository, GradeRepository, type Student, StudentRepository } from "@stu/lib";
import { Cause, Effect, Exit } from "effect";
import { describe, expect, test, vi } from "vitest";
import { applicators } from "./index";

const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const courseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const school = "igs-lil";

const student: Student = {
  id: studentId,
  firstName: "Ada",
  lastName: "Lovelace",
  school,
  class: { identifier: "Q1", startYear: 2024 },
  isOfAge: false,
};

const meta = (initiatorId: string) => ({ initiatorId }) as never;
const unsafe = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect as Effect.Effect<A, E, never>;

describe("student applicator tree integration", () => {
  test("verify rejects disallowed student-scoped events through tree entrypoint", async () => {
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

  test("verify surfaces student.joined class constraints through tree", async () => {
    const classRepo = {
      doesClassExist: () => Effect.succeed(false),
      createClass: () => Effect.void,
      getClass: () => Effect.succeed(undefined),
    };

    const exit = await Effect.runPromiseExit(
      unsafe(
        applicators
          .verify(
            {
              type: "student.joined",
              data: {
                studentId,
                name: "Ada Lovelace",
                school,
                isOfAge: false,
                class: { identifier: "Q1", startYear: 2024 },
              },
            } as never,
            meta(studentId),
          )
          .pipe(Effect.provideService(ClassRepository, classRepo as never)),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("INVALID_CLASS");
    }
  });

  test("apply forwards grades.currentGradeSet to grade repository through tree", async () => {
    const setCurrentGrade = vi.fn(() => Effect.void);
    const studentRepo = {
      createStudent: () => Effect.void,
      assignCourse: () => Effect.void,
      getStudent: () => Effect.succeed(student),
    };
    const gradeRepo = {
      setCurrentGrade: setCurrentGrade,
      recordWrittenGrade: () => Effect.void,
      setTeacherSignature: () => Effect.void,
      setParentSignature: () => Effect.void,
      restoreLatest: () => Effect.void,
      discardGrade: () => Effect.void,
    };

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
            Effect.provideService(StudentRepository, studentRepo as never),
            Effect.provideService(GradeRepository, gradeRepo as never),
          ),
      ),
    );

    expect(setCurrentGrade).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId,
        isSignatureRequired: true,
      }),
    );
  });

  test("apply splits student names through tree in student.joined", async () => {
    const createStudent = vi.fn(() => Effect.void);
    const studentRepo = {
      createStudent: createStudent,
      assignCourse: () => Effect.void,
      getStudent: () => Effect.succeed(student),
    };

    await Effect.runPromise(
      unsafe(
        applicators
          .apply(
            {
              type: "student.joined",
              data: {
                studentId,
                name: "Ada Lovelace Byron",
                school,
                isOfAge: false,
                class: { identifier: "Q1", startYear: 2024 },
              },
            } as never,
            meta(studentId),
          )
          .pipe(Effect.provideService(StudentRepository, studentRepo as never)),
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
