import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";

import { AccountKey } from "../accounts/AccountKey.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";
import { TestCrypto } from "../testing/TestCrypto.ts";
import { SpaceKey } from "./SpaceKey.ts";

const hexOf = (bytes: Result.Result<Uint8Array, { readonly _tag: string }>) =>
  Result.match(bytes, { onFailure: ({ _tag }) => _tag, onSuccess: Hex.encode });

const header = {
  format: 1,
  suite: 1,
  space: "nb",
  keyEpoch: 4,
  recipient: "acc-2",
  recipientGeneration: 1,
  author: "acc-1",
  authorGeneration: 3,
  enc: Uint8Array.of(0xaa, 0xbb),
  ct: Uint8Array.of(0xcc),
};

const boxInfo = [
  "7374752e6b6579626f782e7631", // "stu.keybox.v1"
  "01",
  "000000026e62", // "nb"
  "00000004",
  "000000056163632d32", // "acc-2"
  "00000001",
  "000000056163632d31", // "acc-1"
  "00000003",
].join("");

const linkHeader = {
  suite: 1,
  space: "nb",
  keyEpoch: 5,
  author: "acc-1",
  authorGeneration: 3,
  ct: Uint8Array.of(0xcc, 0xdd),
};

const linkAad = [
  "7374752e6b6579636861696e2e7631", // "stu.keychain.v1"
  "01",
  "000000026e62", // "nb"
  "00000005",
  "000000056163632d31", // "acc-1"
  "00000003",
].join("");

describe("byte layouts", () => {
  it("bind a box's space, epoch and both accounts at their generations", () => {
    assert.deepStrictEqual(
      [hexOf(SpaceKey.boxInfo(header)), hexOf(SpaceKey.boxSigned(header))],
      [boxInfo, `${boxInfo}00000002aabb00000001cc`],
    );
  });

  it("bind a link's space, epoch and author at its generation", () => {
    assert.deepStrictEqual(
      [hexOf(SpaceKey.linkAad(linkHeader)), hexOf(SpaceKey.linkSigned(linkHeader))],
      [linkAad, `${linkAad}00000002ccdd`],
    );
  });
});

const keysOf = (fill: number, account: string, generation: number) =>
  AccountKey.derive(Redacted.make(new Uint8Array(32).fill(fill)), account, generation);

/** Lena at generations 1 and 2, and Tom at 0, each with a self-signed record. */
const accounts = Effect.gen(function* () {
  const lena1 = yield* keysOf(1, "acc-lena", 1);
  const lena2 = yield* keysOf(5, "acc-lena", 2);
  const tom = yield* keysOf(2, "acc-tom", 0);

  return {
    lena1,
    lena1Record: yield* AccountKey.record(lena1, "first"),
    lena2,
    lena2Record: yield* AccountKey.record(lena2, "first"),
    tom,
    tomRecord: yield* AccountKey.record(tom, "first"),
  };
});

const current = { epoch: 4, key: new Uint8Array(32).fill(4) };
const older = { epoch: 3, key: new Uint8Array(32).fill(3) };

const tag = <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.flip(effect), ({ _tag }) => _tag);

const withBox = (patch: Partial<SpaceKey.KeyBox>, original: SpaceKey.KeyBox) =>
  new SpaceKey.KeyBox({
    format: original.format,
    suite: original.suite,
    space: patch.space ?? original.space,
    keyEpoch: patch.keyEpoch ?? original.keyEpoch,
    recipient: original.recipient,
    recipientGeneration: patch.recipientGeneration ?? original.recipientGeneration,
    author: original.author,
    authorGeneration: original.authorGeneration,
    enc: patch.enc ?? original.enc,
    ct: patch.ct ?? original.ct,
    signature: patch.signature ?? original.signature,
  });

const flipped = (bytes: Uint8Array, index: number) => {
  const copy = bytes.slice();
  copy[index] = (copy[index] ?? 0) ^ 1;

  return copy;
};

/** Signs a changed box with its author's key, as a member could. */
const resigned = (changed: SpaceKey.KeyBox, author: AccountKey.Keys) =>
  Effect.gen(function* () {
    const suite = yield* CryptoSuite.Service;
    const message = yield* Effect.fromResult(SpaceKey.boxSigned(changed));
    const signature = yield* suite.sign.sign(Redacted.value(author.signingSeed), message);

    return withBox({ signature }, changed);
  });

describe("openBox", () => {
  it.effect("refuses a box with any part changed, because the signature covers all of it", () =>
    Effect.gen(function* () {
      const { lena1, lena1Record } = yield* accounts;
      const box = yield* SpaceKey.box("nb", [current, older], lena1Record, lena1);

      const tags = yield* Effect.forEach(
        [
          withBox({ enc: flipped(box.enc, 700) }, box),
          withBox({ ct: flipped(box.ct, 20) }, box),
          withBox({ signature: flipped(box.signature, 5) }, box),
          withBox({ keyEpoch: 5 }, box),
        ],
        (changed) => tag(SpaceKey.openBox(changed, "nb", lena1, lena1Record)),
      );

      assert.deepStrictEqual(new Set(tags), new Set(["E2ee.Untrusted"]));
    }).pipe(Effect.provide(TestCrypto.layer("SpaceKey.test"))),
  );

  // The space and recipient come from where the device filed the box, not from the box.
  it.effect("refuses a box sealed for another space or recipient generation, even re-signed", () =>
    Effect.gen(function* () {
      const { lena1, lena1Record } = yield* accounts;
      const chat = yield* SpaceKey.box("chat", [current], lena1Record, lena1);
      const otherGeneration = yield* resigned(withBox({ recipientGeneration: 2 }, chat), lena1);

      assert.deepStrictEqual(
        [
          yield* tag(SpaceKey.openBox(chat, "nb", lena1, lena1Record)),
          yield* tag(SpaceKey.openBox(withBox({ space: "nb" }, chat), "nb", lena1, lena1Record)),
          yield* tag(SpaceKey.openBox(otherGeneration, "chat", lena1, lena1Record)),
        ],
        ["E2ee.Untrusted", "E2ee.Untrusted", "E2ee.Untrusted"],
      );
    }).pipe(Effect.provide(TestCrypto.layer("SpaceKey.test"))),
  );

  // A thief who holds an older generation's root key can still sign at that generation.
  it.effect("refuses a box signed at an older generation of its author", () =>
    Effect.gen(function* () {
      const { lena1, lena1Record, lena2Record, tom } = yield* accounts;
      const tomRecord = yield* AccountKey.record(tom, "first");
      const box = yield* SpaceKey.box("nb", [current], tomRecord, lena1);

      assert.deepStrictEqual(
        [
          yield* tag(SpaceKey.openBox(box, "nb", tom, lena2Record)),
          yield* SpaceKey.verifyBox(box, lena2Record),
          yield* SpaceKey.verifyBox(box, lena1Record),
        ],
        ["E2ee.Untrusted", false, true],
      );
    }).pipe(Effect.provide(TestCrypto.layer("SpaceKey.test"))),
  );

  it.effect("refuses another account's sealing seed and another author's record", () =>
    Effect.gen(function* () {
      const { lena1, lena1Record, tom, tomRecord } = yield* accounts;
      const box = yield* SpaceKey.box("nb", [current, older], lena1Record, lena1);

      assert.deepStrictEqual(
        [
          yield* tag(SpaceKey.openBox(box, "nb", tom, lena1Record)),
          yield* tag(SpaceKey.openBox(box, "nb", lena1, tomRecord)),
        ],
        ["E2ee.Untrusted", "E2ee.Untrusted"],
      );
    }).pipe(Effect.provide(TestCrypto.layer("SpaceKey.test"))),
  );

  // Bytes 1088 to 1119 are X-Wing's X25519 half. Zeroed, it is a low-order point that the KEM
  // refuses; a member who signs such a box must not crash every pull of the space.
  it.effect("fails typed on a crafted encapsulation that its author signed", () =>
    Effect.gen(function* () {
      const { lena1, lena1Record } = yield* accounts;
      const box = yield* SpaceKey.box("nb", [current], lena1Record, lena1);
      const zeroed = box.enc.slice();
      zeroed.fill(0, 1088);

      const crafted = [
        zeroed,
        ...Array.from({ length: 32 }, (_, index) => flipped(box.enc, 1088 + index)),
      ];

      const tags = yield* Effect.forEach(crafted, (enc) =>
        Effect.flatMap(resigned(withBox({ enc }, box), lena1), (changed) =>
          tag(SpaceKey.openBox(changed, "nb", lena1, lena1Record)),
        ),
      );

      assert.isTrue(tags.every((name) => name === "E2ee.Malformed" || name === "E2ee.WrongSecret"));
      assert.strictEqual(tags[0], "E2ee.Malformed");
    }).pipe(Effect.provide(TestCrypto.layer("SpaceKey.test"))),
  );
});

describe("box", () => {
  it.effect("refuses keys that aren't strictly newest first, and an unusable sealing key", () =>
    Effect.gen(function* () {
      const { lena1, lena1Record } = yield* accounts;
      const lowOrder = lena1Record.sealingKey.slice();
      lowOrder.fill(0, 1184);

      const planted = new AccountKey.Record({
        format: lena1Record.format,
        suite: lena1Record.suite,
        accountId: lena1Record.accountId,
        generation: lena1Record.generation,
        reset: lena1Record.reset,
        signingKey: lena1Record.signingKey,
        sealingKey: lowOrder,
        signature: lena1Record.signature,
      });

      assert.deepStrictEqual(
        [
          yield* tag(SpaceKey.box("nb", [older, current], lena1Record, lena1)),
          yield* tag(SpaceKey.box("nb", [current, current], lena1Record, lena1)),
          yield* tag(SpaceKey.box("nb", [current], planted, lena1)),
        ],
        ["E2ee.Malformed", "E2ee.Malformed", "E2ee.Malformed"],
      );
    }).pipe(Effect.provide(TestCrypto.layer("SpaceKey.test"))),
  );
});

describe("openLink", () => {
  it.effect("refuses another space, another current key, a changed link and another author", () =>
    Effect.gen(function* () {
      const { lena1, lena1Record, tomRecord } = yield* accounts;
      const historyLink = yield* SpaceKey.link("nb", current, older.key, lena1);

      const changed = new SpaceKey.HistoryLink({
        format: historyLink.format,
        suite: historyLink.suite,
        space: historyLink.space,
        keyEpoch: historyLink.keyEpoch,
        author: historyLink.author,
        authorGeneration: historyLink.authorGeneration,
        ct: flipped(historyLink.ct, 30),
        signature: historyLink.signature,
      });

      assert.deepStrictEqual(
        [
          yield* tag(SpaceKey.openLink(historyLink, "chat", current, lena1Record)),
          yield* tag(
            SpaceKey.openLink(historyLink, "nb", { ...current, key: older.key }, lena1Record),
          ),
          yield* tag(SpaceKey.openLink(changed, "nb", current, lena1Record)),
          yield* tag(SpaceKey.openLink(historyLink, "nb", current, tomRecord)),
        ],
        ["E2ee.Untrusted", "E2ee.WrongSecret", "E2ee.Untrusted", "E2ee.Untrusted"],
      );
    }).pipe(Effect.provide(TestCrypto.layer("SpaceKey.test"))),
  );
});
