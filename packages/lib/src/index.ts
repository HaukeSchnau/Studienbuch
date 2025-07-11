export * from "./auth";
export * from "./absences";
export * from "./classes";
export * from "./courses";
export * from "./grades";
export * from "./infrastructure";
export * from "./schedule";
export * from "./schools";
export * from "./substitutions";
export * from "./users";
export * from "./years";
export * from "./semesters";
export * from "./theme";
export * from "./result";
export * from "./events";
export * from "./dates";

import { Effect } from "effect";

// TODO: decide if this is the right place for this
export class StudentRepository extends Effect.Tag("StudentRepository")<
  StudentRepository,
  {
    getStudent: (userId: string) => Effect.Effect<{
      isOfAge: boolean;
      userId: string;
    }>;
  }
>() {}
