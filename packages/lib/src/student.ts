import { Context, type Effect } from "effect";
import type { UnknownDatabaseError } from "./repositories";
import type { SchoolId } from "./school";

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  school: SchoolId;
  class: { identifier: string; startYear: number };
  isOfAge: boolean;
}

export class StudentRepository extends Context.Tag("StudentRepository")<
  StudentRepository,
  {
    createStudent: (payload: Student) => Effect.Effect<void, UnknownDatabaseError>;

    assignCourse: (payload: { courseId: string }) => Effect.Effect<void, UnknownDatabaseError>;

    getStudent: (payload: { studentId: string }) => Effect.Effect<Student | undefined, UnknownDatabaseError>;
  }
>() {}
