import { Effect, Option, pipe } from "effect";
import { Database } from "../database";

export const RepositoryDatabase = Effect.gen(function* () {
  const database = yield* Database;

  // @effect-diagnostics-next-line returnEffectInGen:off -- this is intentional to evaluate lazily
  return pipe(
    Effect.serviceOption(Database),
    Effect.andThen(
      Option.match({
        onNone: () => database,
        onSome: (db) => db,
      }),
    ),
  );
});
