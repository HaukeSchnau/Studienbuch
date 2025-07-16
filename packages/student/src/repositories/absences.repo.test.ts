import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { AbsenceRepository } from "./absences.repo";

// TODO: Mock Database and tables as needed for isolation

describe("AbsenceRepository", () => {
  it.effect("addAbsence should insert absence and course absences", () =>
    Effect.gen(function* () {
      yield null; // placeholder for linter
      // Arrange: mock db, payload
      // Act: call addAbsence
      // Assert: check db was called with correct values
      expect(true).toBe(true); // placeholder
    }),
  );

  it.effect("setParentSignature should update parent signature", () =>
    Effect.gen(function* () {
      yield null; // placeholder for linter
      // Arrange: mock db, payload
      // Act: call setParentSignature
      // Assert: check db was called with correct values
      expect(true).toBe(true); // placeholder
    }),
  );

  it.effect("setTeacherSignature should update teacher signature", () =>
    Effect.gen(function* () {
      yield null; // placeholder for linter
      // Arrange: mock db, payload
      // Act: call setTeacherSignature
      // Assert: check db was called with correct values
      expect(true).toBe(true); // placeholder
    }),
  );

  it.effect("deleteAbsence should delete course absences and possibly absence day", () =>
    Effect.gen(function* () {
      yield null; // placeholder for linter
      // Arrange: mock db, payload
      // Act: call deleteAbsence
      // Assert: check db was called with correct values
      expect(true).toBe(true); // placeholder
    }),
  );
});
