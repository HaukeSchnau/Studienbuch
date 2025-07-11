import type { DomainEvent } from "@stu/lib";
import { StudentRepository as StudentRepo } from "./student.repo";

import type { NamespaceApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import type { Database } from "../database";
import type { DatabaseError } from "@schnau/effect-drizzle/generic-sqlite";
import type { GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import { Effect } from "effect";

const failIfTrue = (message: string) =>
  Effect.flatMap((bool) => (bool ? Effect.fail(new ValidationError({ cause: message })) : Effect.void));

export const studentApplicators: NamespaceApplicatorMap<
  DomainEvent,
  "student",
  DatabaseError<GenericSqliteError>,
  Database | StudentRepo
> = {
  joined: {
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== event.data.studentId) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED" }));
      }

      const repo = yield* StudentRepo;
      const classExists = yield* repo.doesClassExist({
        identifier: event.data.class.identifier,
        startYear: event.data.class.startYear,
        school: event.data.school,
      });

      if (!classExists) {
        return yield* Effect.fail(new ValidationError({ cause: "INVALID_CLASS" }));
      }
    }),
    apply: (event) =>
      StudentRepo.use((repo) =>
        repo.createStudent({
          studentId: event.data.studentId,
          name: event.data.name,
          school: event.data.school,
          class: event.data.class,
          isOfAge: event.data.isOfAge,
        }),
      ),
  },

  courseAssigned: {
    verify: (event) =>
      StudentRepo.use((repo) =>
        repo.doesCourseExist({
          courseId: event.data.courseId,
        }),
      ).pipe(failIfTrue("INVALID_COURSE")),
    apply: (event) =>
      StudentRepo.use((repo) =>
        repo.assignCourse({
          courseId: event.data.courseId,
        }),
      ),
  },
};
