import { type NamespaceServerApplicatorMap, ValidationError } from "@groundswell/core";
import { type DomainEvent, studentsOfUser, type UnknownDatabaseError } from "@stu/lib";
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
        if (initiatorId !== event.data.studentId) {
          return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
        }

        const studentRepo = yield* StudentRepository;
        const student = yield* studentRepo.getStudent({ studentId: event.data.studentId });
        if (!student) {
          return yield* Effect.fail(new ValidationError({ cause: "STUDENT_NOT_FOUND", reason: "NOT_FOUND" }));
        }
      }),
    apply: (event) =>
      Effect.gen(function* () {
        const studentRepo = yield* StudentRepository;
        const student = yield* studentRepo
          .getStudent({ studentId: event.data.studentId })
          .pipe(
            Effect.flatMap((value) =>
              value
                ? Effect.succeed(value)
                : Effect.die(new Error(`Student ${event.data.studentId} not found after verify`)),
            ),
          );

        const absenceRepo = yield* AbsenceRepositoryDb;
        yield* absenceRepo.addAbsence({
          studentId: event.data.studentId,
          date: event.data.date,
          reason: event.data.reason,
          courseIds: event.data.courseIds,
          isSignatureRequired: !student.isOfAge,
        });
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfUser(event.data.studentId)]),
  },

  parentApproved: {
    verify: (event, { initiatorId }) =>
      initiatorId !== event.data.studentId
        ? Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }))
        : Effect.void,
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
      initiatorId !== event.data.studentId
        ? Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }))
        : Effect.void,
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
      initiatorId !== event.data.studentId
        ? Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }))
        : Effect.void,
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
