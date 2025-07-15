import { Effect } from "effect";
import type { Salutation } from "@stu/lib";
import { Database } from "../database";
import { eq } from "drizzle-orm";
import * as tables from "../schema";

export class PersonRepository extends Effect.Service<PersonRepository>()("db/PersonRepository", {
  effect: Effect.gen(function* () {
    const getPersonByAbbrv = Effect.fn(function* (payload: { abbrv: string }) {
      const { execute } = yield* Database;
      const rows = yield* execute((db) =>
        db.select().from(tables.Persons).where(eq(tables.Persons.abbrv, payload.abbrv)),
      );
      return rows[0];
    });

    const createPerson = Effect.fn(function* (payload: {
      id: string;
      firstName: string;
      lastName: string;
      salutation: Salutation | undefined;
      abbrv: string;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Persons).values({
          id: payload.id,
          firstName: payload.firstName,
          lastName: payload.lastName,
          salutation: payload.salutation,
          abbrv: payload.abbrv,
        }),
      );
    });

    const getAllPersons = Effect.fn(function* () {
      const { execute } = yield* Database;
      return yield* execute((db) => db.select().from(tables.Persons));
    });

    return {
      getPersonByAbbrv,
      createPerson,
      getAllPersons,
    };
  }),
}) {}
