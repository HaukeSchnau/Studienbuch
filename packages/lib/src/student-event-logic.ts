import { Effect, type Types } from "effect";
import type { Student } from "./student";
import type { StudentId } from "./student-id";

export const verifyStudentInitiator = <E>(options: {
  initiatorId: StudentId;
  studentId: StudentId;
  onForbidden: () => E;
}): Effect.Effect<void, E> =>
  options.initiatorId !== options.studentId ? Effect.fail(options.onForbidden()) : Effect.void;

export const requireStudent = <R, E, E2>(options: {
  studentId: StudentId;
  load: Effect.Effect<Student | undefined, E, R>;
  onMissing: (studentId: StudentId) => E2;
}): Effect.Effect<Student, E | E2, R> =>
  Effect.flatMap(options.load, (student) =>
    student ? Effect.succeed(student) : Effect.fail(options.onMissing(options.studentId)),
  );

export const requireStudentOrDie = <R, E>(options: {
  studentId: StudentId;
  load: Effect.Effect<Student | undefined, E, R>;
  onMissing: (studentId: StudentId) => Types.NoInfer<unknown>;
}): Effect.Effect<Student, E, R> =>
  Effect.flatMap(options.load, (student) =>
    student ? Effect.succeed(student) : Effect.die(options.onMissing(options.studentId)),
  );

export const verifyStudentAccess = <R, EForbidden, ELoad, EMissing>(options: {
  initiatorId: StudentId;
  studentId: StudentId;
  load: Effect.Effect<Student | undefined, ELoad, R>;
  onForbidden: () => EForbidden;
  onMissing: (studentId: StudentId) => EMissing;
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
  studentId: StudentId;
  load: Effect.Effect<Student | undefined, E, R>;
  onMissing: (studentId: StudentId) => E2;
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
  studentId: StudentId;
  load: Effect.Effect<Student | undefined, E, R>;
  onMissing: (studentId: StudentId) => Types.NoInfer<unknown>;
}): Effect.Effect<boolean, E, R> =>
  Effect.map(
    requireStudentOrDie({
      studentId: options.studentId,
      load: options.load,
      onMissing: options.onMissing,
    }),
    (student) => !student.isOfAge,
  );

export const withStudentSignatureRequirement = <RLoad, RRun, ELoad, ERun, EMissing>(options: {
  studentId: StudentId;
  load: Effect.Effect<Student | undefined, ELoad, RLoad>;
  onMissing: (studentId: StudentId) => EMissing;
  run: (isSignatureRequired: boolean) => Effect.Effect<void, ERun, RRun>;
}): Effect.Effect<void, ELoad | ERun | EMissing, RLoad | RRun> =>
  Effect.gen(function* () {
    const isSignatureRequired = yield* requireStudentSignatureRequirement({
      studentId: options.studentId,
      load: options.load,
      onMissing: options.onMissing,
    });

    yield* options.run(isSignatureRequired);
  });

export const withStudentSignatureRequirementOrDie = <RLoad, RRun, ELoad, ERun>(options: {
  studentId: StudentId;
  load: Effect.Effect<Student | undefined, ELoad, RLoad>;
  onMissing: (studentId: StudentId) => Types.NoInfer<unknown>;
  run: (isSignatureRequired: boolean) => Effect.Effect<void, ERun, RRun>;
}): Effect.Effect<void, ELoad | ERun, RLoad | RRun> =>
  Effect.gen(function* () {
    const isSignatureRequired = yield* requireStudentSignatureRequirementOrDie({
      studentId: options.studentId,
      load: options.load,
      onMissing: options.onMissing,
    });

    yield* options.run(isSignatureRequired);
  });

export const splitStudentName = (name: string) => ({
  firstName: name.split(" ")[0] ?? "",
  lastName: name.split(" ").slice(1).join(" "),
});
