import { ApplicatorError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { DomainEvent } from "@stu/lib";
import { AbsenceRepository, StudentRepository } from "@stu/lib";
import { Effect } from "effect";

export const absenceApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "absence",
  DatabaseError<GenericSqliteError> | ApplicatorError,
  StudentRepository | AbsenceRepository
> = {
  recorded: {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== event.data.studentId) {
          return yield* Effect.fail(new ApplicatorError({ cause: "NOT_ALLOWED" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const studentRepo = yield* StudentRepository;
        const student = yield* studentRepo.getStudent({ studentId: event.data.studentId });

        if (!student) {
          return yield* Effect.fail(new ApplicatorError({ cause: `Student ${event.data.studentId} not found` }));
        }

        const absenceRepo = yield* AbsenceRepository;
        yield* absenceRepo.addAbsence({
          date: event.data.date,
          reason: event.data.reason,
          courseIds: event.data.courseIds,
          isSignatureRequired: !student.isOfAge,
        });
      }),
  },

  parentApproved: {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        if (initiatorId !== event.data.studentId) {
          return yield* Effect.fail(new ApplicatorError({ cause: "NOT_ALLOWED" }));
        }
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
      Effect.gen(function* () {
        if (initiatorId !== event.data.studentId) {
          return yield* Effect.fail(new ApplicatorError({ cause: "NOT_ALLOWED" }));
        }
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
      Effect.gen(function* () {
        if (initiatorId !== event.data.studentId) {
          return yield* Effect.fail(new ApplicatorError({ cause: "NOT_ALLOWED" }));
        }
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
