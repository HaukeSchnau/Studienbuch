import { Cause, Effect, Exit } from "effect";
import { describe, expect, test } from "vitest";
import type { Student } from "./student";
import {
  requireStudent,
  requireStudentOrDie,
  requireStudentSignatureRequirement,
  requireStudentSignatureRequirementOrDie,
  splitStudentName,
  verifyStudentAccess,
  verifyStudentInitiator,
  withStudentSignatureRequirement,
  withStudentSignatureRequirementOrDie,
} from "./student-event-logic";

const studentFixture: Student = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  firstName: "Ada",
  lastName: "Lovelace",
  school: "gymnasium-heide-ost" as never,
  class: { identifier: "Q1", startYear: 2024 },
  isOfAge: false,
};

describe("student-event-logic", () => {
  test("verifyStudentInitiator succeeds for matching ids", async () => {
    await Effect.runPromise(
      verifyStudentInitiator({
        initiatorId: studentFixture.id,
        studentId: studentFixture.id,
        onForbidden: () => new Error("forbidden"),
      }),
    );
  });

  test("verifyStudentInitiator fails for mismatched ids", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        verifyStudentInitiator({
          initiatorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          studentId: studentFixture.id,
          onForbidden: () => new Error("forbidden"),
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      const left = result.left as Error;
      expect(left).toBeInstanceOf(Error);
      expect(left.message).toBe("forbidden");
    }
  });

  test("requireStudent returns loaded student", async () => {
    const student = await Effect.runPromise(
      requireStudent({
        studentId: studentFixture.id,
        load: Effect.succeed(studentFixture),
        onMissing: () => new Error("missing"),
      }),
    );

    expect(student).toEqual(studentFixture);
  });

  test("requireStudent fails when student is missing", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        requireStudent({
          studentId: studentFixture.id,
          load: Effect.succeed(undefined),
          onMissing: (studentId) => new Error(`missing ${studentId}`),
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      const left = result.left as Error;
      expect(left).toBeInstanceOf(Error);
      expect(left.message).toContain(studentFixture.id);
    }
  });

  test("requireStudentOrDie defects when student is missing", async () => {
    const exit = await Effect.runPromiseExit(
      requireStudentOrDie({
        studentId: studentFixture.id,
        load: Effect.succeed(undefined),
        onMissing: () => new Error("missing after verify"),
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("missing after verify");
    }
  });

  test("verifyStudentAccess fails when initiator does not match student", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        verifyStudentAccess({
          initiatorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          studentId: studentFixture.id,
          load: Effect.succeed(studentFixture),
          onForbidden: () => new Error("forbidden"),
          onMissing: () => new Error("missing"),
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      const left = result.left as Error;
      expect(left).toBeInstanceOf(Error);
      expect(left.message).toBe("forbidden");
    }
  });

  test("verifyStudentAccess fails when student is missing", async () => {
    const result = await Effect.runPromise(
      Effect.either(
        verifyStudentAccess({
          initiatorId: studentFixture.id,
          studentId: studentFixture.id,
          load: Effect.succeed(undefined),
          onForbidden: () => new Error("forbidden"),
          onMissing: () => new Error("missing"),
        }),
      ),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      const left = result.left as Error;
      expect(left).toBeInstanceOf(Error);
      expect(left.message).toBe("missing");
    }
  });

  test("requireStudentSignatureRequirement returns true when student is under age", async () => {
    const isSignatureRequired = await Effect.runPromise(
      requireStudentSignatureRequirement({
        studentId: studentFixture.id,
        load: Effect.succeed(studentFixture),
        onMissing: () => new Error("missing"),
      }),
    );

    expect(isSignatureRequired).toBe(true);
  });

  test("requireStudentSignatureRequirementOrDie defects when student is missing", async () => {
    const exit = await Effect.runPromiseExit(
      requireStudentSignatureRequirementOrDie({
        studentId: studentFixture.id,
        load: Effect.succeed(undefined),
        onMissing: () => new Error("missing after verify"),
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("missing after verify");
    }
  });

  test("withStudentSignatureRequirement forwards computed signature requirement", async () => {
    const calls: boolean[] = [];

    await Effect.runPromise(
      withStudentSignatureRequirement({
        studentId: studentFixture.id,
        load: Effect.succeed(studentFixture),
        onMissing: () => new Error("missing"),
        run: (isSignatureRequired) =>
          Effect.sync(() => {
            calls.push(isSignatureRequired);
          }),
      }),
    );

    expect(calls).toEqual([true]);
  });

  test("withStudentSignatureRequirementOrDie defects when student is missing", async () => {
    const exit = await Effect.runPromiseExit(
      withStudentSignatureRequirementOrDie({
        studentId: studentFixture.id,
        load: Effect.succeed(undefined),
        onMissing: () => new Error("missing after verify"),
        run: () => Effect.void,
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain("missing after verify");
    }
  });

  test("splitStudentName keeps first token as firstName and the rest as lastName", () => {
    expect(splitStudentName("Ada")).toEqual({
      firstName: "Ada",
      lastName: "",
    });

    expect(splitStudentName("Ada Lovelace Byron")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace Byron",
    });
  });
});
