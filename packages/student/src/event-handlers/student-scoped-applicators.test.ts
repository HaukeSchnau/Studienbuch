import { ApplicatorError } from "@groundswell/core";
import { AbsenceRepository, GradeRepository, GradeTooOldError, type SchoolId, StudentRepository } from "@stu/lib";
import { Cause, Effect, Exit } from "effect";
import { describe, expect, test, vi } from "vitest";
import { absenceApplicators } from "./absences";
import { gradeApplicators } from "./grades";
import { studentApplicators } from "./student";

const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const courseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const school = "gymnasium-heide-ost" as SchoolId;

const student = {
  id: studentId,
  firstName: "Ada",
  lastName: "Lovelace",
  school,
  class: { identifier: "Q1", startYear: 2024 },
  isOfAge: false,
};

const meta = (initiatorId: string) => ({ initiatorId }) as never;

const studentRepoMock = (
  overrides?: Partial<{
    createStudent: (payload: unknown) => Effect.Effect<void>;
    assignCourse: (payload: { courseId: string }) => Effect.Effect<void>;
    getStudent: (payload: { studentId: string }) => Effect.Effect<typeof student | undefined>;
  }>,
) => ({
  createStudent: vi.fn(() => Effect.void),
  assignCourse: vi.fn(() => Effect.void),
  getStudent: vi.fn(() => Effect.succeed(student)),
  ...overrides,
});

describe("student scoped applicators (student package)", () => {
  test("grades.currentGradeSet.verify rejects when initiator is not student", async () => {
    const exit = await Effect.runPromiseExit(
      gradeApplicators.currentGradeSet.verify(
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
      ) as Effect.Effect<void, unknown, never>,
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("NOT_ALLOWED");
    }
  });

  test("grades.currentGradeSet.apply forwards signature requirement from student age", async () => {
    const setCurrentGrade = vi.fn(() => Effect.void);
    const studentRepo = studentRepoMock();

    await Effect.runPromise(
      gradeApplicators.currentGradeSet
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
          Effect.provideService(StudentRepository, studentRepo),
          Effect.provideService(GradeRepository, {
            setCurrentGrade: setCurrentGrade,
            recordWrittenGrade: () => Effect.void,
            setTeacherSignature: () => Effect.void,
            setParentSignature: () => Effect.void,
            restoreLatest: () => Effect.void,
            discardGrade: () => Effect.void,
          }),
        ),
    );

    expect(setCurrentGrade).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId,
        isSignatureRequired: true,
      }),
    );
  });

  test("grades.currentGradeSet.apply maps GradeTooOldError to ApplicatorError", async () => {
    const studentRepo = studentRepoMock();
    const result = await Effect.runPromise(
      Effect.either(
        gradeApplicators.currentGradeSet
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
            Effect.provideService(StudentRepository, studentRepo),
            Effect.provideService(GradeRepository, {
              setCurrentGrade: () =>
                Effect.fail(
                  new GradeTooOldError({
                    courseId,
                    date: new Date("2026-01-01T00:00:00.000Z"),
                    type: "ORAL",
                  }),
                ),
              recordWrittenGrade: () => Effect.void,
              setTeacherSignature: () => Effect.void,
              setParentSignature: () => Effect.void,
              restoreLatest: () => Effect.void,
              discardGrade: () => Effect.void,
            }),
          ),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(ApplicatorError);
    }
  });

  test("absence.recorded.apply forwards signature requirement from student age", async () => {
    const addAbsence = vi.fn(() => Effect.void);
    const studentRepo = studentRepoMock();

    await Effect.runPromise(
      absenceApplicators.recorded
        .apply(
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
          Effect.provideService(StudentRepository, studentRepo),
          Effect.provideService(AbsenceRepository, {
            addAbsence: addAbsence,
            setParentSignature: () => Effect.void,
            setTeacherSignature: () => Effect.void,
            deleteAbsence: () => Effect.void,
          }),
        ),
    );

    expect(addAbsence).toHaveBeenCalledWith(
      expect.objectContaining({
        isSignatureRequired: true,
      }),
    );
  });

  test("student.joined.apply splits first and last name", async () => {
    const createStudent = vi.fn(() => Effect.void);

    await Effect.runPromise(
      (
        studentApplicators.joined.apply(
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
        ) as Effect.Effect<void, unknown, never>
      ).pipe(
        Effect.provideService(StudentRepository, {
          createStudent: createStudent,
          assignCourse: () => Effect.void,
          getStudent: () => Effect.succeed(student),
        }),
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
