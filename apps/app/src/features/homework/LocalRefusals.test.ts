import { assert, describe, it } from "@effect/vitest";
import * as Data from "effect/Data";
import * as Option from "effect/Option";

import { LocalRefusals } from "./LocalRefusals.ts";

class Tick extends Data.TaggedClass("Tick")<{ readonly id: string }> {}

const tick = (id: string) => new Tick({ id });

describe("LocalRefusals", () => {
  it("keeps a refused tick when another homework's tick works, until its own retry works", () => {
    const refusedA = LocalRefusals.settle([], "Tick", "a", Option.some(tick("a")));
    const thenB = LocalRefusals.settle(refusedA, "Tick", "b", Option.none());

    assert.deepStrictEqual(thenB, [tick("a")]);
    assert.deepStrictEqual(LocalRefusals.settle(thenB, "Tick", "a", Option.none()), []);
  });

  it("lets a refusal go when the student dismisses it, and keeps the others", () => {
    const held = LocalRefusals.settle(
      LocalRefusals.settle([], "Tick", "a", Option.some(tick("a"))),
      "Tick",
      "b",
      Option.some(tick("b")),
    );

    assert.deepStrictEqual(LocalRefusals.dismiss(held, tick("a")), [tick("b")]);
  });
});
