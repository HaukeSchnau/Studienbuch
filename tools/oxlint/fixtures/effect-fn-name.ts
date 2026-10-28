import * as Effect from "effect/Effect";

export const add = Effect.fn("Homework.add")(function* () {
  yield* Effect.void;
});

// oxlint-disable-next-line studienbuch/effect-fn-name -- fixture: an unnamed Effect.fn
export const remove = Effect.fn(function* () {
  yield* Effect.void;
});

// oxlint-disable-next-line studienbuch/effect-fn-name -- fixture: a span name without its service
export const rename = Effect.fn("rename")(function* () {
  yield* Effect.void;
});
