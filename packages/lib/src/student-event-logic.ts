import { Effect, type Types } from "effect";
import type { Student } from "./student";

export const verifyStudentInitiator = <E>(options: {
  initiatorId: string;
  studentId: string;
  onForbidden: () => E;
}): Effect.Effect<void, E> =>
  options.initiatorId !== options.studentId ? Effect.fail(options.onForbidden()) : Effect.void;

export const requireStudent = <R, E, E2>(options: {
  studentId: string;
  load: Effect.Effect<Student | undefined, E, R>;
  onMissing: (studentId: string) => E2;
}): Effect.Effect<Student, E | E2, R> =>
  Effect.flatMap(options.load, (student) =>
    student ? Effect.succeed(student) : Effect.fail(options.onMissing(options.studentId)),
  );

export const requireStudentOrDie = <R, E>(options: {
  studentId: string;
  load: Effect.Effect<Student | undefined, E, R>;
  onMissing: (studentId: string) => Types.NoInfer<unknown>;
}): Effect.Effect<Student, E, R> =>
  Effect.flatMap(options.load, (student) =>
    student ? Effect.succeed(student) : Effect.die(options.onMissing(options.studentId)),
  );

export const verifyStudentAccess = <R, EForbidden, ELoad, EMissing>(options: {
  initiatorId: string;
  studentId: string;
  load: Effect.Effect<Student | undefined, ELoad, R>;
  onForbidden: () => EForbidden;
  onMissing: (studentId: string) => EMissing;
}): Effect.Effect<void, EForbidden | ELoad | EMissing, R> =>
  Effect.gen(function* () {
    yield* verifyStudentInitiator({
      initiatorId: options.initiatorId,
      studentId: options.studentId,
      onForbidden: options.onForbidden,
    });
    yield* requireStudent({
      studentId: options.studentId,
      load: options.load,
      onMissing: options.onMissing,
    });
  });

export const requireStudentSignatureRequirement = <R, E, E2>(options: {
  studentId: string;
  load: Effect.Effect<Student | undefined, E, R>;
  onMissing: (studentId: string) => E2;
}): Effect.Effect<boolean, E | E2, R> =>
  Effect.map(
    requireStudent({
      studentId: options.studentId,
      load: options.load,
      onMissing: options.onMissing,
    }),
    (student) => !student.isOfAge,
  );

export const requireStudentSignatureRequirementOrDie = <R, E>(options: {
  studentId: string;
  load: Effect.Effect<Student | undefined, E, R>;
  onMissing: (studentId: string) => Types.NoInfer<unknown>;
}): Effect.Effect<boolean, E, R> =>
  Effect.map(
    requireStudentOrDie({
      studentId: options.studentId,
      load: options.load,
      onMissing: options.onMissing,
    }),
    (student) => !student.isOfAge,
  );

export const splitStudentName = (name: string) => ({
  firstName: name.split(" ")[0] ?? "",
  lastName: name.split(" ").slice(1).join(" "),
});
