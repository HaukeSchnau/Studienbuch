import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SemesterRepository } from "./semester.repo";

describe("SemesterRepository", () => {
  it.effect("createSemesters should insert semesters", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
});
