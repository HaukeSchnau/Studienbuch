import { ApplicatorError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { DomainEvent } from "@stu/lib";
import {
  GradeRepository,
  requireStudentSignatureRequirement,
  StudentRepository,
  verifyStudentInitiator,
} from "@stu/lib";
import { Effect } from "effect";

export const gradeApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "grades",
  DatabaseError<GenericSqliteError> | ApplicatorError,
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
      Effect.gen(function* () {
        const studentRepo = yield* StudentRepository;
        const isSignatureRequired = yield* requireStudentSignatureRequirement({
          studentId: event.data.studentId,
          load: studentRepo.getStudent({ studentId: event.data.studentId }),
          onMissing: (studentId) => new ApplicatorError({ cause: `Student ${studentId} not found` }),
        });

        const gradeRepo = yield* GradeRepository;
        yield* gradeRepo
          .setCurrentGrade({
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
          );
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
      Effect.gen(function* () {
        const studentRepo = yield* StudentRepository;
        const isSignatureRequired = yield* requireStudentSignatureRequirement({
          studentId: event.data.studentId,
          load: studentRepo.getStudent({ studentId: event.data.studentId }),
          onMissing: (studentId) => new ApplicatorError({ cause: `Student ${studentId} not found` }),
        });

        const repo = yield* GradeRepository;

        yield* repo.recordWrittenGrade({
          courseId: event.data.courseId,
          date: event.data.date,
          result: event.data.result,
          isSignatureRequired,
        });
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
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
        }),
      ),
  },
};
