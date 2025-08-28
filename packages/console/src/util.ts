import { PersonRepository } from "@stu/db";
import { ensureEntityDefined } from "@stu/lib";
import { Effect } from "effect";

export const getTeacherIdByAbbrv = Effect.fn(function* (abbrv: string) {
  const teachersRepo = yield* PersonRepository;
  return yield* teachersRepo.getPersonByAbbrv({ abbrv }).pipe(
    Effect.flatMap(ensureEntityDefined("teacher", { abbrv })),
    Effect.map((teacher) => teacher.id),
  );
});
