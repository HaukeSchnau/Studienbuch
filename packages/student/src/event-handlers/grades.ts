import { ApplicatorError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { UnknownDatabaseError } from "@stu/lib";
import { GradeRepository, StudentRepository, verifyStudentInitiator, withStudentSignatureRequirement } from "@stu/lib";
import { Effect } from "effect";
import type { DomainEvent } from "../domain-event";

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
        load: Effect.service(StudentRepository).pipe(
          Effect.flatMap((repo) => repo.getStudent({ studentId: event.data.studentId })),
        ),
        onMissing: (studentId) => new ApplicatorError({ cause: `Student ${studentId} not found` }),
        run: (isSignatureRequired) =>
          Effect.service(GradeRepository).pipe(
            Effect.flatMap((gradeRepo) =>
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
        load: Effect.service(StudentRepository).pipe(
          Effect.flatMap((repo) => repo.getStudent({ studentId: event.data.studentId })),
        ),
        onMissing: (studentId) => new ApplicatorError({ cause: `Student ${studentId} not found` }),
        run: (isSignatureRequired) =>
          Effect.service(GradeRepository).pipe(
            Effect.flatMap((repo) =>
              repo.recordWrittenGrade({
                studentId: event.data.studentId,
                courseId: event.data.courseId,
                date: event.data.date,
                result: event.data.result,
                isSignatureRequired,
              }),
            ),
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
      Effect.service(GradeRepository).pipe(
        Effect.flatMap((repo) =>
          repo.setTeacherSignature({
            studentId: event.data.studentId,
            course: event.data.course,
            date: event.data.date,
            type: event.data.type,
            signature: event.data.signature,
          }),
        ),
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
      Effect.service(GradeRepository).pipe(
        Effect.flatMap((repo) =>
          repo.setParentSignature({
            studentId: event.data.studentId,
            course: event.data.course,
            date: event.data.date,
            type: event.data.type,
            signature: event.data.signature,
          }),
        ),
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
      Effect.service(GradeRepository).pipe(
        Effect.flatMap((repo) =>
          repo.restoreLatest({
            studentId: event.data.studentId,
            course: event.data.course,
            type: event.data.type,
          }),
        ),
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
      Effect.service(GradeRepository).pipe(
        Effect.flatMap((repo) =>
          repo.discardGrade({
            studentId: event.data.studentId,
            course: event.data.course,
            date: event.data.date,
            type: event.data.type,
          }),
        ),
      ),
  },
};
