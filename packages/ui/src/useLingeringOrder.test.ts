import { describe, expect, it } from "@effect/vitest";

import { lingeringOrder } from "./useLingeringOrder.ts";

describe("lingeringOrder", () => {
  it.each([
    [
      "keeps the shown order while the same items change places",
      ["a", "b", "c"],
      ["b", "c", "a"],
      ["a", "b", "c"],
    ],
    ["takes the new order once an item came", ["a", "b"], ["c", "b", "a"], ["c", "b", "a"]],
    ["takes the new order once an item went", ["a", "b", "c"], ["c", "a"], ["c", "a"]],
    ["takes the new order when one item replaced another", ["a", "b"], ["b", "c"], ["b", "c"]],
  ])("%s", (_, shown, sorted, expected) => {
    expect(lingeringOrder(shown, sorted)).toEqual(expected);
  });
});
