import { type NamespaceServerApplicatorMap, ValidationError } from "@groundswell/core";
import {
  type DomainEvent,
  type StudentId,
  studentsOfUser,
  type UnknownDatabaseError,
  verifyStudentAccess,
  verifyStudentInitiator,
  withStudentSignatureRequirementOrDie,
} from "@stu/lib";
import { Effect } from "effect";
import type { Database } from "../database";
import { GradeRepositoryDb } from "../repositories/grade.repo";
import { StudentRepository } from "../repositories/student.repo";

const asStudentId = (studentId: string): StudentId => studentId as StudentId;

export const gradeApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "grades",
  UnknownDatabaseError,
  Database | StudentRepository | GradeRepositoryDb
> = {
  currentGradeSet: {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        const studentId = asStudentId(event.data.studentId);

        yield* verifyStudentAccess({
          initiatorId,
          studentId,
          load: Effect.andThen(StudentRepository, (repo) => repo.getStudent({ studentId })),
          onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
          onMissing: () => new ValidationError({ cause: "STUDENT_NOT_FOUND", reason: "NOT_FOUND" }),
        });

        const gradeRepo = yield* GradeRepositoryDb;
        const latestGradeDate = yield* gradeRepo.getLatestGradeDate({
          studentId,
          courseId: event.data.courseId,
          type: event.data.type,
        });
        if (latestGradeDate && latestGradeDate.getTime() >= event.data.date.getTime()) {
          return yield* Effect.fail(new ValidationError({ cause: "GRADE_TOO_OLD", reason: "INVALID" }));
        }
      }),
    apply: (event) => {
      const studentId = asStudentId(event.data.studentId);

      return withStudentSignatureRequirementOrDie({
        studentId,
        load: Effect.andThen(StudentRepository, (repo) => repo.getStudent({ studentId })),
        onMissing: (studentId) => new Error(`Student ${studentId} not found after verify`),
        run: (isSignatureRequired) =>
          Effect.andThen(GradeRepositoryDb, (gradeRepo) =>
            gradeRepo.setCurrentGrade({
              studentId,
              courseId: event.data.courseId,
              date: event.data.date,
              result: event.data.result,
              type: event.data.type,
              isSignatureRequired,
            }),
          ),
      });
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(asStudentId(event.data.studentId))]),
  },

  writtenGradeRecorded: {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        const studentId = asStudentId(event.data.studentId);

        yield* verifyStudentAccess({
          initiatorId,
          studentId,
          load: Effect.andThen(StudentRepository, (repo) => repo.getStudent({ studentId })),
          onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
          onMissing: () => new ValidationError({ cause: "STUDENT_NOT_FOUND", reason: "NOT_FOUND" }),
        });
      }),
    apply: (event) => {
      const studentId = asStudentId(event.data.studentId);

      return withStudentSignatureRequirementOrDie({
        studentId,
        load: Effect.andThen(StudentRepository, (repo) => repo.getStudent({ studentId })),
        onMissing: (studentId) => new Error(`Student ${studentId} not found after verify`),
        run: (isSignatureRequired) =>
          Effect.andThen(GradeRepositoryDb, (gradeRepo) =>
            gradeRepo.recordWrittenGrade({
              studentId,
              courseId: event.data.courseId,
              date: event.data.date,
              result: event.data.result,
              isSignatureRequired,
            }),
          ),
      });
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(asStudentId(event.data.studentId))]),
  },

  teacherApproved: {
    verify: (event, { initiatorId }) => {
      const studentId = asStudentId(event.data.studentId);

      return verifyStudentInitiator({
        initiatorId,
        studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      });
    },
    apply: (event) => {
      const studentId = asStudentId(event.data.studentId);

      return Effect.andThen(GradeRepositoryDb, (repo) =>
        repo.setTeacherSignature({
          studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
          signature: event.data.signature,
        }),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(asStudentId(event.data.studentId))]),
  },

  parentApproved: {
    verify: (event, { initiatorId }) => {
      const studentId = asStudentId(event.data.studentId);

      return verifyStudentInitiator({
        initiatorId,
        studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      });
    },
    apply: (event) => {
      const studentId = asStudentId(event.data.studentId);

      return Effect.andThen(GradeRepositoryDb, (repo) =>
        repo.setParentSignature({
          studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
          signature: event.data.signature,
        }),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(asStudentId(event.data.studentId))]),
  },

  latestRestored: {
    verify: (event, { initiatorId }) => {
      const studentId = asStudentId(event.data.studentId);

      return verifyStudentInitiator({
        initiatorId,
        studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      });
    },
    apply: (event) => {
      const studentId = asStudentId(event.data.studentId);

      return Effect.andThen(GradeRepositoryDb, (repo) =>
        repo.restoreLatest({
          studentId,
          course: event.data.course,
          type: event.data.type,
        }),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(asStudentId(event.data.studentId))]),
  },

  discarded: {
    verify: (event, { initiatorId }) => {
      const studentId = asStudentId(event.data.studentId);

      return verifyStudentInitiator({
        initiatorId,
        studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      });
    },
    apply: (event) => {
      const studentId = asStudentId(event.data.studentId);

      return Effect.andThen(GradeRepositoryDb, (repo) =>
        repo.discardGrade({
          studentId,
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
        }),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(asStudentId(event.data.studentId))]),
  },
};
