import { ApplicatorError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { DomainEvent } from "@stu/lib";
import {
  AbsenceRepository,
  requireStudentSignatureRequirement,
  StudentRepository,
  verifyStudentInitiator,
} from "@stu/lib";
import { Effect } from "effect";

export const absenceApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "absence",
  DatabaseError<GenericSqliteError> | ApplicatorError,
  StudentRepository | AbsenceRepository
> = {
  recorded: {
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

        const absenceRepo = yield* AbsenceRepository;
        yield* absenceRepo.addAbsence({
          date: event.data.date,
          reason: event.data.reason,
          courseIds: event.data.courseIds,
          isSignatureRequired,
        });
      }),
  },

  parentApproved: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ApplicatorError({ cause: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(AbsenceRepository, (repo) =>
        repo.setParentSignature({
          date: event.data.date,
          signature: event.data.signature,
        }),
      ),
  },

  teacherApproved: {
    verify: (event, { initiatorId }) =>
      verifyStudentInitiator({
        initiatorId,
        studentId: event.data.studentId,
        onForbidden: () => new ApplicatorError({ cause: "NOT_ALLOWED" }),
      }),
    apply: (event) =>
      Effect.andThen(AbsenceRepository, (repo) =>
        repo.setTeacherSignature({
          date: event.data.date,
          courseId: event.data.courseId,
          signature: event.data.signature,
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
      Effect.andThen(AbsenceRepository, (repo) =>
        repo.deleteAbsence({
          date: event.data.date,
          courseIds: event.data.courseIds,
        }),
      ),
  },
};
