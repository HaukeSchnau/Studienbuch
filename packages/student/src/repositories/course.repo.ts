import { CourseRepository } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const CourseRepositoryLive = Layer.effect(
  CourseRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const getCourse = Effect.fn(function* (payload: { id: string }) {
      const { execute } = yield* databaseContext;
      const course = yield* execute((db) =>
        db.query.courses.findFirst({
          where: eq(tables.courses.id, payload.id),
        }),
      );
      if (!course) {
        return undefined;
      }

      const { semesterType, semesterYear, ...rest } = course;
      return {
        ...rest,
        semester: { type: semesterType, year: semesterYear },
      };
    });

    return {
      getCourse,

      doesCourseExist: Effect.fn(function* (payload) {
        const course = yield* getCourse(payload);
        return course !== undefined;
      }),

      createCourse: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
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
      }, Database.asTransactionCustom(databaseContext)),
    };
  }),
);
