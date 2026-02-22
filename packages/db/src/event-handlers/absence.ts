import { type NamespaceServerApplicatorMap, ValidationError } from "@groundswell/core";
import {
  type DomainEvent,
  requireStudentSignatureRequirementOrDie,
  studentsOfUser,
  type UnknownDatabaseError,
  verifyStudentAccess,
  verifyStudentInitiator,
} from "@stu/lib";
import { Effect } from "effect";
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
        yield* verifyStudentAccess({
          initiatorId,
          studentId: event.data.studentId,
          load: Effect.andThen(StudentRepository, (repo) => repo.getStudent({ studentId: event.data.studentId })),
          onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
          onMissing: () => new ValidationError({ cause: "STUDENT_NOT_FOUND", reason: "NOT_FOUND" }),
        });
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const studentRepo = yield* StudentRepository;
        const isSignatureRequired = yield* requireStudentSignatureRequirementOrDie({
          studentId: event.data.studentId,
          load: studentRepo.getStudent({ studentId: event.data.studentId }),
          onMissing: (studentId) => new Error(`Student ${studentId} not found after verify`),
        });

        const absenceRepo = yield* AbsenceRepositoryDb;
        yield* absenceRepo.addAbsence({
          studentId: event.data.studentId,
          date: event.data.date,
          reason: event.data.reason,
          courseIds: event.data.courseIds,
          isSignatureRequired,
        });
      }),
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
      Effect.andThen(AbsenceRepositoryDb, (repo) =>
        repo.setParentSignature({
          studentId: event.data.studentId,
          date: event.data.date,
          signature: event.data.signature,
        }),
      ),
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
      Effect.andThen(AbsenceRepositoryDb, (repo) =>
        repo.setTeacherSignature({
          studentId: event.data.studentId,
          date: event.data.date,
          courseId: event.data.courseId,
          signature: event.data.signature,
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
      Effect.andThen(AbsenceRepositoryDb, (repo) =>
        repo.deleteAbsence({
          studentId: event.data.studentId,
          date: event.data.date,
          courseIds: event.data.courseIds,
        }),
      ),
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId)]),
  },
};
