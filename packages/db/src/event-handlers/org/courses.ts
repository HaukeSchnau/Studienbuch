import { ValidationError } from "@groundswell/core";
import { applyOrgCoursesCreated, ClassRepository, studentsOfCourse, verifyOrgCoursesCreated } from "@stu/lib";
import { Effect } from "effect";
import { verifySystemInitiator } from "./context";
import type { OrgApplicatorMap } from "./types";

export const courseApplicators: Pick<OrgApplicatorMap, "courses.created"> = {
  "courses.created": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        yield* verifyOrgCoursesCreated({
          data: event.data as never,
          onDuplicate: () => new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }),
        });

        const classRepo = yield* Effect.service(ClassRepository);
        for (const cls of event.data.classes) {
          const existingClass = yield* classRepo.getClass({
            identifier: cls.identifierInYear,
            startYear: cls.startYear,
            school: event.data.school,
          });
          if (!existingClass) {
            return yield* Effect.fail(new ValidationError({ cause: "CLASS_NOT_FOUND", reason: "NOT_FOUND" }));
          }
        }
      }),
    apply: (event) =>
      applyOrgCoursesCreated({
        data: event.data as never,
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfCourse(event.data.id)]),
  },
};
