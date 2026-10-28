import * as Effect from "effect/Effect";

export const recovered = Effect.void.pipe(
  // oxlint-disable-next-line studienbuch/prefer-catch-tags -- fixture: one tag through catchTag
  Effect.catchTag("Failed", () => Effect.void),
);

export const both = Effect.void.pipe(Effect.catchTags({ Failed: () => Effect.void }));
