import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";
import { TestCrypto } from "../testing/TestCrypto.ts";
import { SealedRow } from "./SealedRow.ts";

const envelope = new SealedRow.Envelope({ format: 1, suite: 1, keyEpoch: 2, author: "acc-1" });

const hexOf = (bytes: Result.Result<Uint8Array, { readonly _tag: string }>) =>
  Result.match(bytes, { onFailure: ({ _tag }) => _tag, onSuccess: Hex.encode });

describe("aad", () => {
  it("binds the row, the space, the key epoch and the author", () => {
    assert.strictEqual(
      hexOf(SealedRow.aad({ space: "notebook-1", id: "row-1" }, envelope)),
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

  // TextEncoder writes U+FFFD for an unpaired surrogate, so two ids would share their bytes.
  it("refuses an id with an unpaired surrogate, and keeps a paired one", () => {
    const refused = ["row-\ud800", "row-\udc00x", "row-\ud83d\ude00"].map(
      (id) => hexOf(SealedRow.aad({ space: "nb", id }, envelope)) === "E2ee.Malformed",
    );

    assert.deepStrictEqual(refused, [true, true, false]);
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

describe("paddedLength", () => {
  it("pads to a power of two of at least 1,024 bytes, with room for the marker", () => {
    assert.deepStrictEqual(
      [0, 1023, 1024, 2047, 2048].map(SealedRow.paddedLength),
      [1024, 1024, 2048, 2048, 4096],
    );
  });
});

const key = new Uint8Array(32).fill(7);
const row = { space: "notebook-1", id: "row-1", table: "Homework", json: '{"title":"Seite 41"}' };

const sealed = SealedRow.seal(row, "acc-1", 2, key);

const changed = (original: SealedRow.Envelope, patch: Partial<SealedRow.Envelope>) =>
  new SealedRow.Envelope({
    format: patch.format ?? original.format,
    suite: patch.suite ?? original.suite,
    keyEpoch: patch.keyEpoch ?? original.keyEpoch,
    author: patch.author ?? original.author,
  });

describe("open", () => {
  // GCM authenticates every byte, so the nonce, the tag and every 13th byte between them stand for
  // the rest; all 1,052 would take over a second on a loaded host.
  it.effect("refuses a ciphertext with a bit flipped in its nonce, body or tag", () =>
    Effect.gen(function* () {
      const { envelope, ct } = yield* sealed;
      const tagStart = ct.length - 16;

      const positions = Array.from({ length: ct.length }, (_, index) => index).filter(
        (index) => index < 12 || index >= tagStart || index % 13 === 0,
      );

      const failures = yield* Effect.forEach(positions, (index) => {
        const tampered = ct.slice();
        tampered[index] = (tampered[index] ?? 0) ^ (1 << (index % 8));

        return Effect.map(
          Effect.flip(SealedRow.open(row, envelope, tampered, key)),
          ({ _tag }) => _tag,
        );
      });

      assert.deepStrictEqual([...new Set(failures)], ["E2ee.WrongSecret"]);
    }).pipe(Effect.provide(TestCrypto.layer("SealedRow.test"))),
  );

  it.effect(
    "refuses the ciphertext in another row, space, epoch or author, or under another key",
    () =>
      Effect.gen(function* () {
        const { envelope, ct } = yield* sealed;

        const attempts = [
          SealedRow.open({ ...row, id: "row-2" }, envelope, ct, key),
          SealedRow.open({ ...row, space: "notebook-2" }, envelope, ct, key),
          SealedRow.open(row, changed(envelope, { keyEpoch: 3 }), ct, key),
          SealedRow.open(row, changed(envelope, { author: "acc-2" }), ct, key),
          SealedRow.open(row, envelope, ct, new Uint8Array(32).fill(8)),
        ];

        const tags = yield* Effect.forEach(attempts, (attempt) =>
          Effect.map(Effect.flip(attempt), ({ _tag }) => _tag),
        );

        assert.deepStrictEqual(
          tags,
          Array.from({ length: 5 }, () => "E2ee.WrongSecret"),
        );
      }).pipe(Effect.provide(TestCrypto.layer("SealedRow.test"))),
  );

  // A later minimum must not strand rows padded to an earlier one.
  it.effect("opens a row padded to only 256 bytes", () =>
    Effect.gen(function* () {
      const suite = yield* CryptoSuite.Service;
      const plaintext = new Uint8Array(256);
      const inner = Bytes.concat(Bytes.lp(Bytes.label(row.table)), Bytes.label(row.json));
      plaintext.set(inner);
      plaintext[inner.length] = 0x80;
      const associated = yield* Effect.fromResult(SealedRow.aad(row, envelope));
      const nonce = new Uint8Array(12).fill(1);
      const ct = Bytes.concat(nonce, yield* suite.aead.seal(key, nonce, plaintext, associated));
      const opened = yield* SealedRow.open(row, envelope, ct, key);

      assert.deepStrictEqual([ct.length, opened.json], [284, row.json]);
    }).pipe(Effect.provide(TestCrypto.layer("SealedRow.test"))),
  );

  it.effect("parks a newer format or suite as unsupported instead of failing to decrypt", () =>
    Effect.gen(function* () {
      const { envelope, ct } = yield* sealed;
      const newer = changed(envelope, { format: 2 });
      const error = yield* Effect.flip(SealedRow.open(row, newer, ct, key));

      assert.deepStrictEqual(
        error._tag === "E2ee.Unsupported" && [error.version, error.suite],
        [2, 1],
      );
    }).pipe(Effect.provide(TestCrypto.layer("SealedRow.test"))),
  );
});
