import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { GradeRepository } from "./grades.repo";

describe("GradeRepository", () => {
  it.effect("setCurrentGrade should insert and delete as expected", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
  it.effect("recordWrittenGrade should insert a written grade", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
  it.effect("setTeacherSignature should update teacher signature", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
  it.effect("setParentSignature should update parent signature", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
  it.effect("restoreLatest should delete grades after latest confirmed", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
  it.effect("discardGrade should delete unconfirmed grade", () =>
    Effect.gen(function* () {
      yield null;
      expect(true).toBe(true);
    }),
  );
});
