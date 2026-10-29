import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Schema from "effect/Schema";

import { SealedRow } from "./SealedRow.ts";

const envelope = new SealedRow.Envelope({ format: 1, suite: 1, keyEpoch: 2, author: "acc-1" });

describe("aad", () => {
  it("binds the row, the space, the key epoch and the author", () => {
    assert.strictEqual(
      Hex.encode(SealedRow.aad({ space: "notebook-1", id: "row-1" }, envelope)),
      [
        "7374752e726f772e7631", // "stu.row.v1"
        "01",
        "0000000a6e6f7465626f6f6b2d31", // "notebook-1"
        "00000005726f772d31", // "row-1"
        "00000002",
        "000000056163632d31", // "acc-1"
        "00000000", // the empty table name
      ].join(""),
    );
  });
});

const decodeEnvelope = Schema.decodeEffect(Schema.toCodecJson(SealedRow.Envelope));

describe("Envelope", () => {
  // The server deploys first and newer apps write first, so an older app must still decode what
  // they write, and refuse it only when it opens the row.
  it.effect("decodes a newer format with fields this build doesn't know", () =>
    Effect.gen(function* () {
      const newer = { format: 2, suite: 7, keyEpoch: 3, author: "acc-1", lock: { by: "acc-2" } };
      const decoded = yield* decodeEnvelope(newer);

      assert.deepStrictEqual(
        [decoded.format, decoded.suite, decoded.keyEpoch, decoded.author],
        [2, 7, 3, "acc-1"],
      );
    }),
  );
});
