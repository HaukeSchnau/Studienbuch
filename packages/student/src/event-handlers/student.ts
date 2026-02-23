import type { NamespaceApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import type { DomainEvent, UnknownDatabaseError } from "@stu/lib";
import {
  ClassRepository,
  CourseRepository,
  StudentRepository,
  splitStudentName,
  verifyStudentInitiator,
} from "@stu/lib";
import { Effect } from "effect";

const failIfFalse = (message: string, reason: "DUPLICATE" | "INVALID" | "NOT_ALLOWED" | "NOT_FOUND" | "UNKNOWN") =>
  Effect.flatMap((bool) => (bool ? Effect.void : Effect.fail(new ValidationError({ cause: message, reason }))));

export const studentApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "student",
  UnknownDatabaseError,
  StudentRepository | ClassRepository | CourseRepository
> = {
  joined: {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifyStudentInitiator({
          initiatorId,
          studentId: event.data.studentId,
          onForbidden: () => new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }),
        });

        const repo = yield* ClassRepository;
        const classExists = yield* repo.doesClassExist({
          identifier: event.data.class.identifier,
          startYear: event.data.class.startYear,
          school: event.data.school,
        });

        if (!classExists) {
          return yield* Effect.fail(new ValidationError({ cause: "INVALID_CLASS", reason: "NOT_FOUND" }));
        }
      }),
    apply: (event) =>
      Effect.andThen(StudentRepository, (repo) => {
        const { firstName, lastName } = splitStudentName(event.data.name);

        return repo.createStudent({
          id: event.data.studentId,
          firstName,
          lastName,
          school: event.data.school,
          class: event.data.class,
          isOfAge: event.data.isOfAge,
        });
      }),
  },

  courseAssigned: {
    verify: (event) =>
      Effect.andThen(CourseRepository, (repo) =>
        repo.doesCourseExist({
          id: event.data.courseId,
        }),
      ).pipe(failIfFalse("INVALID_COURSE", "NOT_FOUND")),
    apply: (event) =>
      Effect.andThen(StudentRepository, (repo) =>
        repo.assignCourse({
          courseId: event.data.courseId,
        }),
      ),
  },
};
