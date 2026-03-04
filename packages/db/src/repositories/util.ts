import { Effect, Option, pipe } from "effect";
import { Database } from "../database";

export const RepositoryDatabase = Effect.gen(function* () {
  const database = yield* Effect.service(Database);

  // @effect-diagnostics-next-line returnEffectInGen:off -- this is intentional to evaluate lazily
  return pipe(
    Effect.serviceOption(Database),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed(database),
        onSome: (db) => Effect.succeed(db),
      }),
    ),
  );
});
