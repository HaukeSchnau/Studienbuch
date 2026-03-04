import { ValidationError } from "@groundswell/core";
import { applyOrgSchoolFounded, studentsOfSchool, verifyOrgSchoolFounded } from "@stu/lib";
import { Effect } from "effect";
import { PersonRepository } from "../../repositories/person.repo";
import { verifySystemInitiator } from "./context";
import type { OrgApplicatorMap } from "./types";

export const schoolApplicators: Pick<OrgApplicatorMap, "school.founded" | "teacher.joined"> = {
  "school.founded": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        yield* verifyOrgSchoolFounded({
          data: event.data as never,
          onDuplicate: () => new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }),
        });
      }),
    apply: (event) =>
      applyOrgSchoolFounded({
        data: event.data as never,
      }),
    getEventTopics: (event) => Effect.succeed([studentsOfSchool(event.data.id)]),
  },
  "teacher.joined": {
    verify: (event, { initiatorId }) =>
      Effect.gen(function* () {
        yield* verifySystemInitiator(initiatorId);
        const repo = yield* Effect.service(PersonRepository);
        if (yield* repo.getPersonByAbbrv({ abbrv: event.data.abbrv })) {
          return yield* Effect.fail(new ValidationError({ cause: "EXISTS", reason: "DUPLICATE" }));
        }
      }),
    apply: (event) =>
      PersonRepository.use((repo) =>
        repo.createPerson({
          id: event.data.personId,
          firstName: event.data.firstName ?? "",
          lastName: event.data.lastName ?? "",
          salutation: event.data.salutation,
          abbrv: event.data.abbrv,
        }),
      ),
    getEventTopics: (event) => Effect.succeed([studentsOfSchool(event.data.school)]),
  },
};
