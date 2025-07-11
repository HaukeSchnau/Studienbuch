import { StudentRepository, type DomainEvent } from "@stu/lib";

import type { NamespaceApplicatorMap } from "@groundswell/core";
import type { Database } from "../database";
import type { DatabaseError } from "@schnau/effect-drizzle/generic-sqlite";
import type { GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import { Effect } from "effect";
import { GradeRepository } from "./grades.repo";

export const gradeApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "grades",
  DatabaseError<GenericSqliteError>,
  Database | StudentRepository | GradeRepository
> = {
  currentGradeSet: {
    verify: () => Effect.void,
    apply: Effect.fn(function* (event, { initiatorId }) {
      const student = yield* StudentRepository.use((repo) => repo.getStudent(initiatorId));
      const repo = yield* GradeRepository;

      yield* repo.setCurrentGrade({
        courseId: event.data.courseId,
        date: event.data.date,
        result: event.data.result,
        type: event.data.type,
        isSignatureRequired: !student.isOfAge,
      });
    }),
  },

  writtenGradeRecorded: {
    verify: () => Effect.void,
    apply: Effect.fn(function* (event, { initiatorId }) {
      const student = yield* StudentRepository.use((repo) => repo.getStudent(initiatorId));
      const repo = yield* GradeRepository;

      yield* repo.recordWrittenGrade({
        courseId: event.data.courseId,
        date: event.data.date,
        result: event.data.result,
        isSignatureRequired: !student.isOfAge,
      });
    }),
  },

  teacherApproved: {
    verify: () => Effect.void,
    apply: (event) =>
      GradeRepository.use((repo) =>
        repo.setTeacherSignature({
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
          signature: event.data.signature,
        }),
      ),
  },

  parentApproved: {
    verify: () => Effect.void,
    apply: (event) =>
      GradeRepository.use((repo) =>
        repo.setParentSignature({
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
          signature: event.data.signature,
        }),
      ),
  },

  latestRestored: {
    verify: () => Effect.void,
    apply: (event) =>
      GradeRepository.use((repo) =>
        repo.restoreLatest({
          course: event.data.course,
          type: event.data.type,
        }),
      ),
  },

  discarded: {
    verify: () => Effect.void,
    apply: (event) =>
      GradeRepository.use((repo) =>
        repo.discardGrade({
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
        }),
      ),
  },
};
