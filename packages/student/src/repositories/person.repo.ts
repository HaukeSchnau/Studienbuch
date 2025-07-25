import { PersonRepository } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const PersonRepositoryLive = Layer.effect(
  PersonRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    return {
      doesTeacherExist: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        const teacher = yield* execute((db) =>
          db.query.persons.findFirst({
            where: eq(tables.persons.id, payload.id),
          }),
        );
        return teacher !== undefined;
      }),

      createTeacher: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.persons).values({
            id: payload.personId,
            firstName: payload.firstName ?? "",
            lastName: payload.lastName ?? "",
            salutation: payload.salutation,
            abbrv: payload.abbrv,
          }),
        );
      }),
    };
  }),
);
