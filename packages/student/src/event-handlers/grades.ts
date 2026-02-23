import { ApplicatorError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { DomainEvent, UnknownDatabaseError } from "@stu/lib";
import { GradeRepository, StudentRepository, verifyStudentInitiator, withStudentSignatureRequirement } from "@stu/lib";
import { Effect } from "effect";

export const gradeApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "grades",
  UnknownDatabaseError | ApplicatorError,
  StudentRepository | GradeRepository
> = {
  currentGradeSet: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ApplicatorError({ cause: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      withStudentSignatureRequirement({
        studentId: event.data.studentId,
        load: Effect.andThen(StudentRepository, (repo) => repo.getStudent({ studentId: event.data.studentId })),
        onMissing: (studentId) => new ApplicatorError({ cause: `Student ${studentId} not found` }),
        run: (isSignatureRequired) =>
          Effect.andThen(GradeRepository, (gradeRepo) =>
            gradeRepo
              .setCurrentGrade({
                studentId: event.data.studentId,
                courseId: event.data.courseId,
                date: event.data.date,
                result: event.data.result,
                type: event.data.type,
                isSignatureRequired,
              })
              .pipe(
                Effect.catchTag("GradeTooOldError", (error) => {
                  return Effect.fail(new ApplicatorError({ cause: error.message }));
                }),
              ),
          ),
      }),
  },

  writtenGradeRecorded: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ApplicatorError({ cause: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      withStudentSignatureRequirement({
        studentId: event.data.studentId,
        load: Effect.andThen(StudentRepository, (repo) => repo.getStudent({ studentId: event.data.studentId })),
        onMissing: (studentId) => new ApplicatorError({ cause: `Student ${studentId} not found` }),
        run: (isSignatureRequired) =>
          Effect.andThen(GradeRepository, (repo) =>
            repo.recordWrittenGrade({
              studentId: event.data.studentId,
              courseId: event.data.courseId,
              date: event.data.date,
              result: event.data.result,
              isSignatureRequired,
            }),
          ),
      }),
  },

  teacherApproved: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ApplicatorError({ cause: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(GradeRepository, (repo) =>
        repo.setTeacherSignature({
          studentId: event.data.studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
          signature: event.data.signature,
        }),
      ),
  },

  parentApproved: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ApplicatorError({ cause: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(GradeRepository, (repo) =>
        repo.setParentSignature({
          studentId: event.data.studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
          signature: event.data.signature,
        }),
      ),
  },

  latestRestored: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ApplicatorError({ cause: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(GradeRepository, (repo) =>
        repo.restoreLatest({
          studentId: event.data.studentId,
          course: event.data.course,
          type: event.data.type,
        }),
      ),
  },

  discarded: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ApplicatorError({ cause: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(GradeRepository, (repo) =>
        repo.discardGrade({
          studentId: event.data.studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
        }),
      ),
  },
};
