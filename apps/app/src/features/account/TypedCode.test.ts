import { assert, it } from "@effect/vitest";

import { TypedCode } from "./TypedCode.ts";

/** Types `keys` one at a time from `caret` on, as a keyboard does, and answers field and caret. */
const type = (field: string, caret: number, keys: string) =>
  Array.from(keys).reduce(
    (at, key) => {
      const text = `${at.value.slice(0, at.caret)}${key}${at.value.slice(at.caret)}`;

      return TypedCode.access(at.value, text, { start: at.caret, end: at.caret });
    },
    { value: field, caret },
  );

it("keeps the whole code when it is pasted with blanks around it or between its groups", () => {
  const pasted = ["  DEM0-0000-0000-0000 ", "DEM0 - 0000 - 0000 - 0000", "dem0 0000 0000 0000"].map(
    (text) => TypedCode.access("", text, { start: 0, end: 0 }),
  );

  assert.deepStrictEqual(
    pasted,
    pasted.map(() => ({ value: "DEM0-0000-0000-0000", caret: 19 })),
  );
});

it("keeps the caret behind what is typed in the middle of the code", () => {
  const typed = type("", 0, "abcdefghjk");

  // Two characters in, as Home, Right, Right leave it.
  assert.deepStrictEqual(type(typed.value, 2, "xyz"), { value: "ABXY-ZCDE-FGHJ-K", caret: 6 });
});

it("puts the caret where a character was deleted, and before a hyphen it can't delete", () => {
  const code = "ABCD-EFGH-JK";

  assert.deepStrictEqual(
    [
      TypedCode.access(code, "ABC-EFGH-JK", { start: 4, end: 4 }),
      TypedCode.access(code, "ABCDEFGH-JK", { start: 5, end: 5 }),
    ],
    [
      { value: "ABCE-FGHJ-K", caret: 3 },
      { value: "ABCD-EFGH-JK", caret: 4 },
    ],
  );
});
