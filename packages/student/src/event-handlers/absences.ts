import { StudentRepository, type DomainEvent } from "@stu/lib";

import type { NamespaceApplicatorMap } from "@groundswell/core";
import type { DatabaseError } from "@schnau/effect-drizzle/generic-sqlite";
import type { GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import { Effect } from "effect";
import type { Database } from "../database";
import { AbsenceRepository } from "./absences.repo";

export const absenceApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "absence",
  DatabaseError<GenericSqliteError>,
  Database | StudentRepository | AbsenceRepository
> = {
  recorded: {
    verify: () => Effect.void,
    apply: Effect.fn(function* (event, { initiatorId }) {
      const student = yield* StudentRepository.use((repo) => repo.getStudent(initiatorId));
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
