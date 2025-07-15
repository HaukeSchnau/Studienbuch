import type { DomainEvent } from "@stu/lib";
import { StudentRepository } from "../repositories/student.repo";

import type { NamespaceServerApplicatorMap } from "@groundswell/core";
import { ValidationError } from "@groundswell/core";
import type { Database } from "../database";
import type { DatabaseError } from "@schnau/effect-drizzle/postgres";
import { Effect } from "effect";

export const studentApplicators: NamespaceServerApplicatorMap<
  DomainEvent,
  "student",
  DatabaseError,
  Database | StudentRepository
> = {
  joined: {
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== event.data.studentId) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
      }

      const repo = yield* StudentRepository;
      const school = yield* repo.getSchoolOfUser({
        studentId: event.data.studentId,
      });
      if (!school || school !== event.data.school) {
        return yield* Effect.fail(new ValidationError({ cause: "INVALID_SCHOOL", reason: "NOT_FOUND" }));
      }

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
      StudentRepository.use((repo) => {
        const firstName = event.data.name.split(" ")[0] ?? "";
        const lastName = event.data.name.split(" ").slice(1).join(" ");

        return repo.createStudent({
          studentId: event.data.studentId,
          firstName: firstName,
          lastName: lastName,
          school: event.data.school,
          class: event.data.class,
          isOfAge: event.data.isOfAge,
        });
      }),
    getEventTopics: () => Effect.succeed([]),
  },

  courseAssigned: {
    verify: Effect.fn(function* (event, { initiatorId }) {
      if (initiatorId !== event.data.studentId) {
        return yield* Effect.fail(new ValidationError({ cause: "NOT_ALLOWED", reason: "NOT_ALLOWED" }));
      }

      const repo = yield* StudentRepository;
      const isAssigned = yield* repo.isAssignedToCourse({
        studentId: event.data.studentId,
        courseId: event.data.courseId,
      });

      if (isAssigned) {
        return yield* Effect.fail(new ValidationError({ cause: "ALREADY_ASSIGNED", reason: "DUPLICATE" }));
      }
    }),
    apply: (event) =>
      StudentRepository.use((repo) =>
        repo.assignCourse({
          studentId: event.data.studentId,
          courseId: event.data.courseId,
        }),
      ),
    getEventTopics: () => Effect.succeed([]),
  },
};
