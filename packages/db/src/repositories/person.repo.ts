import type { Salutation } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect, Layer, ServiceMap } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class PersonRepository extends ServiceMap.Service<PersonRepository>()("db/PersonRepository", {
  make: Effect.gen(function* () {
    const getPersonByAbbrv = Effect.fn(function* (payload: { abbrv: string }) {
      const { execute } = yield* Effect.service(Database);
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
      const { execute } = yield* Effect.service(Database);
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
      const { execute } = yield* Effect.service(Database);
      return yield* execute((db) => db.select().from(tables.Persons));
    });

    return {
      getPersonByAbbrv,
      createPerson,
      getAllPersons,
    };
  }),
}) {
  static readonly Default = Layer.effect(PersonRepository, PersonRepository.make);
}
