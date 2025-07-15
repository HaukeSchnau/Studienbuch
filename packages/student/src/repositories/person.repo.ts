import { Effect } from "effect";
import { Database } from "../database";
import type { Salutation } from "@stu/lib";
import * as tables from "../schema";
import { eq } from "drizzle-orm";

export class PersonRepository extends Effect.Service<PersonRepository>()("student/PersonRepository", {
  effect: Effect.gen(function* () {
    const doesTeacherExist = Effect.fn(function* (payload: { id: string }) {
      const { execute } = yield* Database;
      const teacher = yield* execute((db) =>
        db.query.persons.findFirst({
          where: eq(tables.persons.id, payload.id),
        }),
      );
      return teacher !== undefined;
    });

    const createTeacher = Effect.fn(function* (payload: {
      personId: string;
      firstName?: string;
      lastName?: string;
      salutation?: Salutation;
      abbrv: string;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.persons).values({
          id: payload.personId,
          firstName: payload.firstName ?? "",
          lastName: payload.lastName ?? "",
          salutation: payload.salutation,
          abbrv: payload.abbrv,
        }),
      );
    });

    return {
      doesTeacherExist,
      createTeacher,
    };
  }),
}) {}
