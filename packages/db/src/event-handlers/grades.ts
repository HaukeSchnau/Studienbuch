import { type NamespaceServerApplicatorMap, ValidationError } from "@groundswell/core";
import {
  type StudentId,
  studentsOfUser,
  type UnknownDatabaseError,
  verifyStudentAccess,
  verifyStudentInitiator,
  withStudentSignatureRequirementOrDie,
} from "@stu/lib";
import { Effect } from "effect";
import type { DomainEvent } from "../domain-event";
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
        const studentId = event.data.studentId as StudentId;

        yield* verifyStudentAccess({
          initiatorId,
          studentId,
          load: Effect.service(StudentRepository).pipe(Effect.flatMap((repo) => repo.getStudent({ studentId }))),
          onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
          onMissing: () => new ValidationError({ cause: "STUDENT_NOT_FOUND", reason: "NOT_FOUND" }),
        });

        const gradeRepo = yield* Effect.service(GradeRepositoryDb);
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
      const studentId = event.data.studentId as StudentId;

      return withStudentSignatureRequirementOrDie({
        studentId,
        load: Effect.service(StudentRepository).pipe(Effect.flatMap((repo) => repo.getStudent({ studentId }))),
        onMissing: (studentId) => new Error(`Student ${studentId} not found after verify`),
        run: (isSignatureRequired) =>
          Effect.service(GradeRepositoryDb).pipe(
            Effect.flatMap((gradeRepo) =>
              gradeRepo.setCurrentGrade({
                studentId,
                courseId: event.data.courseId,
                date: event.data.date,
                result: event.data.result,
                type: event.data.type,
                isSignatureRequired,
              }),
            ),
          ),
      });
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId as StudentId)]),
  },

  writtenGradeRecorded: {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        const studentId = event.data.studentId as StudentId;

        yield* verifyStudentAccess({
          initiatorId,
          studentId,
          load: Effect.service(StudentRepository).pipe(Effect.flatMap((repo) => repo.getStudent({ studentId }))),
          onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
          onMissing: () => new ValidationError({ cause: "STUDENT_NOT_FOUND", reason: "NOT_FOUND" }),
        });
      }),
    apply: (event) => {
      const studentId = event.data.studentId as StudentId;

      return withStudentSignatureRequirementOrDie({
        studentId,
        load: Effect.service(StudentRepository).pipe(Effect.flatMap((repo) => repo.getStudent({ studentId }))),
        onMissing: (studentId) => new Error(`Student ${studentId} not found after verify`),
        run: (isSignatureRequired) =>
          Effect.service(GradeRepositoryDb).pipe(
            Effect.flatMap((gradeRepo) =>
              gradeRepo.recordWrittenGrade({
                studentId,
                courseId: event.data.courseId,
                date: event.data.date,
                result: event.data.result,
                isSignatureRequired,
              }),
            ),
          ),
      });
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId as StudentId)]),
  },

  teacherApproved: {
    verify: (event, { initiatorId }) => {
      const studentId = event.data.studentId as StudentId;

      return verifyStudentInitiator({
        initiatorId,
        studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      });
    },
    apply: (event) => {
      const studentId = event.data.studentId as StudentId;

      return Effect.service(GradeRepositoryDb).pipe(
        Effect.flatMap((repo) =>
          repo.setTeacherSignature({
            studentId,
            course: event.data.course,
            date: event.data.date,
            type: event.data.type,
            signature: event.data.signature,
          }),
        ),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId as StudentId)]),
  },

  parentApproved: {
    verify: (event, { initiatorId }) => {
      const studentId = event.data.studentId as StudentId;

      return verifyStudentInitiator({
        initiatorId,
        studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      });
    },
    apply: (event) => {
      const studentId = event.data.studentId as StudentId;

      return Effect.service(GradeRepositoryDb).pipe(
        Effect.flatMap((repo) =>
          repo.setParentSignature({
            studentId,
            course: event.data.course,
            date: event.data.date,
            type: event.data.type,
            signature: event.data.signature,
          }),
        ),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId as StudentId)]),
  },

  latestRestored: {
    verify: (event, { initiatorId }) => {
      const studentId = event.data.studentId as StudentId;

      return verifyStudentInitiator({
        initiatorId,
        studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      });
    },
    apply: (event) => {
      const studentId = event.data.studentId as StudentId;

      return Effect.service(GradeRepositoryDb).pipe(
        Effect.flatMap((repo) =>
          repo.restoreLatest({
            studentId,
            course: event.data.course,
            type: event.data.type,
          }),
        ),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId as StudentId)]),
  },

  discarded: {
    verify: (event, { initiatorId }) => {
      const studentId = event.data.studentId as StudentId;

      return verifyStudentInitiator({
        initiatorId,
        studentId,
        onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
      });
    },
    apply: (event) => {
      const studentId = event.data.studentId as StudentId;

      return Effect.service(GradeRepositoryDb).pipe(
        Effect.flatMap((repo) =>
          repo.discardGrade({
            studentId,
            course: event.data.course,
            date: event.data.date,
            type: event.data.type,
          }),
        ),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId as StudentId)]),
  },
};
