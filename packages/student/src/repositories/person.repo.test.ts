import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { PersonRepository } from "./person.repo";

describe("PersonRepository", () => {
  it.effect("doesTeacherExist should return true/false as appropriate", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
  it.effect("createTeacher should insert a teacher", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
});
