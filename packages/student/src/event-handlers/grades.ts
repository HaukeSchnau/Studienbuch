import { ApplicatorError, type NamespaceApplicatorMap } from "@groundswell/core";
import type { DatabaseError, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type { DomainEvent } from "@stu/lib";
import { GradeRepository, StudentRepository } from "@stu/lib";
import { Effect } from "effect";
import type { Database } from "../database";

export const gradeApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "grades",
  DatabaseError<GenericSqliteError> | ApplicatorError,
  Database | StudentRepository | GradeRepository
> = {
  currentGradeSet: {
    verify: () => Effect.void,
    apply: Effect.fn(function* (event, { initiatorId }) {
      const studentRepo = yield* StudentRepository;
      const student = yield* studentRepo.getStudent({ studentId: initiatorId });
      if (!student) {
        return yield* Effect.fail(new ApplicatorError({ cause: `Student ${initiatorId} not found` }));
      }

      const gradeRepo = yield* GradeRepository;
      yield* gradeRepo
        .setCurrentGrade({
          courseId: event.data.courseId,
          date: event.data.date,
          result: event.data.result,
          type: event.data.type,
          isSignatureRequired: !student.isOfAge,
        })
        .pipe(
          Effect.catchTag("GradeTooOldError", (error) => {
            return Effect.fail(new ApplicatorError({ cause: error.message }));
          }),
        );
    }),
  },

  writtenGradeRecorded: {
    verify: () => Effect.void,
    apply: Effect.fn(function* (event, { initiatorId }) {
      const studentRepo = yield* StudentRepository;
      const student = yield* studentRepo.getStudent({ studentId: initiatorId });
      if (!student) {
        return yield* Effect.fail(new ApplicatorError({ cause: `Student ${initiatorId} not found` }));
      }

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
      Effect.andThen(GradeRepository, (repo) =>
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
      Effect.andThen(GradeRepository, (repo) =>
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
      Effect.andThen(GradeRepository, (repo) =>
        repo.restoreLatest({
          course: event.data.course,
          type: event.data.type,
        }),
      ),
  },

  discarded: {
    verify: () => Effect.void,
    apply: (event) =>
      Effect.andThen(GradeRepository, (repo) =>
        repo.discardGrade({
          course: event.data.course,
          date: event.data.date,
          type: event.data.type,
        }),
      ),
  },
};
