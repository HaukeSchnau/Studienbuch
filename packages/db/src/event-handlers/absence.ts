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
import { AbsenceRepositoryDb } from "../repositories/absence.repo";
import { StudentRepository } from "../repositories/student.repo";

const asStudentId = (studentId: string): StudentId => studentId as StudentId;

export const absenceApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "absence",
  UnknownDatabaseError,
  Database | StudentRepository | AbsenceRepositoryDb
> = {
  recorded: {
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
          Effect.andThen(AbsenceRepositoryDb, (absenceRepo) =>
            absenceRepo.addAbsence({
              studentId,
              date: event.data.date,
              reason: event.data.reason,
              courseIds: event.data.courseIds,
              isSignatureRequired,
            }),
          ),
      });
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

      return Effect.andThen(AbsenceRepositoryDb, (repo) =>
        repo.setParentSignature({
          studentId,
          date: event.data.date,
          signature: event.data.signature,
        }),
      );
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

      return Effect.andThen(AbsenceRepositoryDb, (repo) =>
        repo.setTeacherSignature({
          studentId,
          date: event.data.date,
          courseId: event.data.courseId,
          signature: event.data.signature,
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

      return Effect.andThen(AbsenceRepositoryDb, (repo) =>
        repo.deleteAbsence({
          studentId,
          date: event.data.date,
          courseIds: event.data.courseIds,
        }),
      );
    },
    getEventTopics: (event) => Effect.succeed([studentsOfUser(asStudentId(event.data.studentId))]),
  },
};
