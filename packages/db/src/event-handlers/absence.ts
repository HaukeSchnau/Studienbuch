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
import { AbsenceRepositoryDb } from "../repositories/absence.repo";
import { StudentRepository } from "../repositories/student.repo";

export const absenceApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "absence",
  UnknownDatabaseError,
  Database | StudentRepository | AbsenceRepositoryDb
> = {
  recorded: {
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
          Effect.service(AbsenceRepositoryDb).pipe(
            Effect.flatMap((absenceRepo) =>
              absenceRepo.addAbsence({
                studentId,
                date: event.data.date,
                reason: event.data.reason,
                courseIds: event.data.courseIds,
                isSignatureRequired,
              }),
            ),
          ),
      });
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

      return Effect.service(AbsenceRepositoryDb).pipe(
        Effect.flatMap((repo) =>
          repo.setParentSignature({
            studentId,
            date: event.data.date,
            signature: event.data.signature,
          }),
        ),
      );
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

      return Effect.service(AbsenceRepositoryDb).pipe(
        Effect.flatMap((repo) =>
          repo.setTeacherSignature({
            studentId,
            date: event.data.date,
            courseId: event.data.courseId,
            signature: event.data.signature,
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

      return Effect.service(AbsenceRepositoryDb).pipe(
        Effect.flatMap((repo) =>
          repo.deleteAbsence({
            studentId,
            date: event.data.date,
            courseIds: event.data.courseIds,
          }),
        ),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId as StudentId)]),
  },
};
