import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { NonBlankText } from "./non-blank-text";

const Holder = Schema.Struct({ name: NonBlankText.Schema });

describe("NonBlankText", () => {
  // `make` is how every aggregate in this package is built, so it has to reject what `decode`
  // rejects. It did not: the non-blank filter sat on the encoded side only.
  it("rejects whitespace-only text at construction", () => {
    assert.throws(() => Holder.make({ name: "   " }));
  });

  it.effect("rejects whitespace-only text at decode", () =>
    Schema.decodeEffect(Holder)({ name: "   " }).pipe(Effect.flip, Effect.asVoid),
  );

  it("preserves author-provided spacing", () => {
    assert.strictEqual(Holder.make({ name: " Frau  Müller " }).name, " Frau  Müller ");
  });
});
