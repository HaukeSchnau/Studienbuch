import { type NamespaceServerApplicatorMap, ValidationError } from "@groundswell/core";
import {
  type DomainEvent,
  requireStudent,
  requireStudentOrDie,
  studentsOfUser,
  type UnknownDatabaseError,
  verifyStudentInitiator,
} from "@stu/lib";
import { Effect } from "effect";
import type { Database } from "../database";
import { GradeRepositoryDb } from "../repositories/grade.repo";
import { StudentRepository } from "../repositories/student.repo";

export const gradeApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "grades",
  UnknownDatabaseError,
  Database | StudentRepository | GradeRepositoryDb
> = {
  currentGradeSet: {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifyStudentInitiator({
          initiatorId,
          studentId: event.data.studentId,
          onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
        });

        const studentRepo = yield* StudentRepository;
        yield* requireStudent({
          studentId: event.data.studentId,
          load: studentRepo.getStudent({ studentId: event.data.studentId }),
          onMissing: () => new ValidationError({ cause: "STUDENT_NOT_FOUND", reason: "NOT_FOUND" }),
        });

        const gradeRepo = yield* GradeRepositoryDb;
        const latestGradeDate = yield* gradeRepo.getLatestGradeDate({
          studentId: event.data.studentId,
          courseId: event.data.courseId,
          type: event.data.type,
        });
        if (latestGradeDate && latestGradeDate.getTime() >= event.data.date.getTime()) {
          return yield* Effect.fail(new ValidationError({ cause: "GRADE_TOO_OLD", reason: "INVALID" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const studentRepo = yield* StudentRepository;
        const student = yield* requireStudentOrDie({
          studentId: event.data.studentId,
          load: studentRepo.getStudent({ studentId: event.data.studentId }),
          onMissing: (studentId) => new Error(`Student ${studentId} not found after verify`),
        });

        const gradeRepo = yield* GradeRepositoryDb;
        yield* gradeRepo.setCurrentGrade({
          studentId: event.data.studentId,
          courseId: event.data.courseId,
          date: event.data.date,
          result: event.data.result,
          type: event.data.type,
          isSignatureRequired: !student.isOfAge,
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId)]),
  },

  writtenGradeRecorded: {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifyStudentInitiator({
          initiatorId,
          studentId: event.data.studentId,
          onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
        });

        const studentRepo = yield* StudentRepository;
        yield* requireStudent({
          studentId: event.data.studentId,
          load: studentRepo.getStudent({ studentId: event.data.studentId }),
          onMissing: () => new ValidationError({ cause: "STUDENT_NOT_FOUND", reason: "NOT_FOUND" }),
        });
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const studentRepo = yield* StudentRepository;
        const student = yield* requireStudentOrDie({
          studentId: event.data.studentId,
          load: studentRepo.getStudent({ studentId: event.data.studentId }),
          onMissing: (studentId) => new Error(`Student ${studentId} not found after verify`),
        });

        const gradeRepo = yield* GradeRepositoryDb;
        yield* gradeRepo.recordWrittenGrade({
          studentId: event.data.studentId,
          courseId: event.data.courseId,
          date: event.data.date,
          result: event.data.result,
          isSignatureRequired: !student.isOfAge,
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId)]),
  },

  teacherApproved: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(GradeRepositoryDb, (repo) =>
        repo.setTeacherSignature({
          studentId: event.data.studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
          signature: event.data.signature,
        }),
      ),
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId)]),
  },

  parentApproved: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(GradeRepositoryDb, (repo) =>
        repo.setParentSignature({
          studentId: event.data.studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
          signature: event.data.signature,
        }),
      ),
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId)]),
  },

  latestRestored: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(GradeRepositoryDb, (repo) =>
        repo.restoreLatest({
          studentId: event.data.studentId,
          course: event.data.course,
          type: event.data.type,
        }),
      ),
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId)]),
  },

  discarded: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(GradeRepositoryDb, (repo) =>
        repo.discardGrade({
          studentId: event.data.studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
        }),
      ),
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId)]),
  },
};
