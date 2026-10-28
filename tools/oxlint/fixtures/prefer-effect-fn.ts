import * as Effect from "effect/Effect";

// oxlint-disable-next-line studienbuch/prefer-effect-fn -- fixture: an arrow that only runs a generator
export const load = (id: string) =>
  Effect.gen(function* () {
    yield* Effect.log(id);
  });

export const service = {
  // oxlint-disable-next-line studienbuch/prefer-effect-fn -- fixture: a service member
  save: () =>
    Effect.gen(function* () {
      yield* Effect.void;
    }),
};

// Named functions, inline programs and match callbacks pass.
export const read = Effect.fn("Homework.read")(function* (id: string) {
  yield* Effect.log(id);
});

export const program = Effect.gen(function* () {
  yield* read("a");
});

export const recovered = program.pipe(
  Effect.catchTags({
    Failed: () =>
      Effect.gen(function* () {
        yield* Effect.void;
      }),
  }),
);
