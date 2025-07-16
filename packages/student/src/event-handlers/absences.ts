import type { DomainEvent } from "@stu/lib";

import { ApplicatorError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { DatabaseError } from "@schnau/effect-drizzle/generic-sqlite";
import type { GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import { Effect } from "effect";
import type { Database } from "../database";
import { AbsenceRepository } from "../repositories/absences.repo";
import { StudentRepository } from "../repositories/student.repo";

export const absenceApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "absence",
  DatabaseError<GenericSqliteError> | ApplicatorError,
  Database | StudentRepository | AbsenceRepository
> = {
  recorded: {
    verify: () => Effect.void,
    apply: Effect.fn(function* (event, { initiatorId }) {
      const student = yield* StudentRepository.use((repo) => repo.getStudent({ studentId: initiatorId }));

      if (!student) {
        return yield* Effect.fail(new ApplicatorError({ cause: `Student ${initiatorId} not found` }));
      }

      const repo = yield* AbsenceRepository;

      repo.addAbsence({
        date: event.data.date,
        reason: event.data.reason,
        courseIds: event.data.courseIds,
        isSignatureRequired: !student.isOfAge,
      });
    }),
  },

  parentApproved: {
    verify: () => Effect.void,
    apply: (event) =>
      AbsenceRepository.use((repo) =>
        repo.setParentSignature({
          date: event.data.date,
          signature: event.data.signature,
        }),
      ),
  },

  teacherApproved: {
    verify: () => Effect.void,
    apply: (event) =>
      AbsenceRepository.use((repo) =>
        repo.setTeacherSignature({
          date: event.data.date,
          courseId: event.data.courseId,
          signature: event.data.signature,
        }),
      ),
  },

  discarded: {
    verify: () => Effect.void,
    apply: (event) =>
      AbsenceRepository.use((repo) =>
        repo.deleteAbsence({
          date: event.data.date,
          courseIds: event.data.courseIds,
        }),
      ),
  },
};
