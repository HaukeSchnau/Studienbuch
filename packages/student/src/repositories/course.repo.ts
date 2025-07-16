import type { SchoolId, SubjectId } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class CourseRepository extends Effect.Service<CourseRepository>()("student/CourseRepository", {
  effect: Effect.gen(function* () {
    const doesCourseExist = Effect.fn(function* (payload: { id: string }) {
      const { execute } = yield* Database;
      const course = yield* execute((db) =>
        db.query.courses.findFirst({
          where: eq(tables.courses.id, payload.id),
        }),
      );
      return course !== undefined;
    });

    const createCourse = Effect.fn(function* (payload: {
      id: string;
      name: string;
      subject: SubjectId;
      school: SchoolId;
      semester: { type: "WINTER" | "SUMMER"; year: number };
      isMandatory: boolean;
      teachers: string[];
      classes: Array<{ identifierInYear: string; startYear: number }>;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.courses).values({
          id: payload.id,
          name: payload.name,
          subject: payload.subject,
          school: payload.school,
          semesterType: payload.semester.type,
          semesterYear: payload.semester.year,
          isMandatory: payload.isMandatory,
          isMember: false,
        }),
      );
      for (const teacher of payload.teachers) {
        yield* execute((db) =>
          db.insert(tables.coursesToTeachers).values({
            course: payload.id,
            teacher,
          }),
        );
      }
      for (const cls of payload.classes) {
        yield* execute((db) =>
          db.insert(tables.coursesToClasses).values({
            course: payload.id,
            classIdentifier: cls.identifierInYear,
            classStartYear: cls.startYear,
            school: payload.school,
          }),
        );
      }
    }, Database.asTransaction);

    return {
      doesCourseExist,
      createCourse,
    };
  }),
}) {}
