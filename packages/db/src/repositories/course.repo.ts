import { Effect } from "effect";
import type { SchoolId, SemesterType } from "@stu/lib";
import { Database } from "../database";
import { eq } from "drizzle-orm";
import * as tables from "../schema";
import type { Subject } from "../schema/school/courses";

export class CourseRepository extends Effect.Service<CourseRepository>()("db/CourseRepository", {
  effect: Effect.gen(function* () {
    const getCourse = Effect.fn(function* (payload: { id: string }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.Courses.findFirst({
          where: eq(tables.Courses.id, payload.id),
        }),
      );
    });

    const createCourse = Effect.fn(function* (payload: {
      id: string;
      name: string;
      subject: (typeof Subject.enumValues)[number];
      school: SchoolId;
      semester: { type: SemesterType; year: number };
      isMandatory: boolean;
      teachers: string[];
      classes: { identifierInYear: string; startYear: number }[];
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Courses).values({
          id: payload.id,
          name: payload.name,
          subject: payload.subject,
          school: payload.school,
          semesterType: payload.semester.type,
          semesterYear: payload.semester.year,
          isMandatory: payload.isMandatory,
        }),
      );
      for (const teacher of payload.teachers) {
        yield* execute((db) =>
          db.insert(tables.CoursesToTeachers).values({
            course: payload.id,
            teacher,
          }),
        );
      }
      for (const cls of payload.classes) {
        yield* execute((db) =>
          db.insert(tables.CoursesToClasses).values({
            course: payload.id,
            classIdentifier: cls.identifierInYear,
            classStartYear: cls.startYear,
            school: payload.school,
          }),
        );
      }
    }, Database.asTransaction);

    return {
      getCourse,
      createCourse,
    };
  }),
}) {}
