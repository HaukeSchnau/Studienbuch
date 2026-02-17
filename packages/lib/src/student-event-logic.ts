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

export const splitStudentName = (name: string) => ({
  firstName: name.split(" ")[0] ?? "",
  lastName: name.split(" ").slice(1).join(" "),
});
