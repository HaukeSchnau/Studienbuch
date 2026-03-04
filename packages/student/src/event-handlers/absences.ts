import { ApplicatorError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { UnknownDatabaseError } from "@stu/lib";
import {
  AbsenceRepository,
  StudentRepository,
  verifyStudentInitiator,
  withStudentSignatureRequirement,
} from "@stu/lib";
import { Effect } from "effect";
import type { DomainEvent } from "../domain-event";

export const absenceApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "absence",
  UnknownDatabaseError | ApplicatorError,
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
      withStudentSignatureRequirement({
        studentId: event.data.studentId,
        load: Effect.service(StudentRepository).pipe(
          Effect.flatMap((repo) => repo.getStudent({ studentId: event.data.studentId })),
        ),
        onMissing: (studentId) => new ApplicatorError({ cause: `Student ${studentId} not found` }),
        run: (isSignatureRequired) =>
          Effect.service(AbsenceRepository).pipe(
            Effect.flatMap((absenceRepo) =>
              absenceRepo.addAbsence({
                studentId: event.data.studentId,
                date: event.data.date,
                reason: event.data.reason,
                courseIds: event.data.courseIds,
                isSignatureRequired,
              }),
            ),
          ),
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
      Effect.service(AbsenceRepository).pipe(
        Effect.flatMap((repo) =>
          repo.setParentSignature({
            studentId: event.data.studentId,
            date: event.data.date,
            signature: event.data.signature,
          }),
        ),
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
      Effect.service(AbsenceRepository).pipe(
        Effect.flatMap((repo) =>
          repo.setTeacherSignature({
            studentId: event.data.studentId,
            date: event.data.date,
            courseId: event.data.courseId,
            signature: event.data.signature,
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
      Effect.service(AbsenceRepository).pipe(
        Effect.flatMap((repo) =>
          repo.deleteAbsence({
            studentId: event.data.studentId,
            date: event.data.date,
            courseIds: event.data.courseIds,
          }),
        ),
      ),
  },
};
