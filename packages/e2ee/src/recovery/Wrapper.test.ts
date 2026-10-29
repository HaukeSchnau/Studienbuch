import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { AccountKey } from "../accounts/AccountKey.ts";
import { Bytes } from "../format/Bytes.ts";
import { E2ee } from "../format/E2ee.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";
import { TestCrypto } from "../testing/TestCrypto.ts";
import { Wrapper } from "./Wrapper.ts";

const isUntrusted = Schema.is(E2ee.Untrusted);

/** The error's tag, or for `Untrusted` which check refused. */
const tag = <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.flip(effect), (error) => (isUntrusted(error) ? error.reason : error._tag));

const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const secret = (fill: number, length = 32) => Redacted.make(bytes(fill, length));

const device: Wrapper.Method = { id: "w-device", kind: "device", place: "", credentialId: "" };
const passkey: Wrapper.Method = { id: "w-prf", kind: "prf", place: "", credentialId: "cred-1" };
const card: Wrapper.Method = { id: "w-code", kind: "code", place: "card", credentialId: "" };

const methods: ReadonlyArray<readonly [Wrapper.Method, number, number]> = [
  [device, 1, 32],
  [passkey, 2, 32],
  [card, 3, 16],
];

/** Lena's generations 0 to 2, each linked from the one before. */
const account = Effect.gen(function* () {
  const keys0 = yield* AccountKey.derive(secret(10), "acc-lena", 0);
  const record0 = yield* AccountKey.record(keys0, "first");
  const keys1 = yield* AccountKey.derive(secret(11), "acc-lena", 1);
  const record1 = yield* AccountKey.record(keys1, { keys: keys0, record: record0 });
  const keys2 = yield* AccountKey.derive(secret(12), "acc-lena", 2);
  const record2 = yield* AccountKey.record(keys2, { keys: keys1, record: record1 });

  return { keys0, record0, keys1, record1, keys2, record2 };
});

const withSeal = (original: Wrapper.Seal, patch: Partial<Wrapper.Seal>) =>
  new Wrapper.Seal({
    format: original.format,
    suite: original.suite,
    wrapperId: original.wrapperId,
    accountId: original.accountId,
    generation: patch.generation ?? original.generation,
    enc: patch.enc ?? original.enc,
    ct: patch.ct ?? original.ct,
  });

const withStatement = (original: Wrapper.Statement, patch: Partial<Wrapper.Statement>) =>
  new Wrapper.Statement({
    format: original.format,
    suite: original.suite,
    id: original.id,
    accountId: original.accountId,
    kind: patch.kind ?? original.kind,
    place: original.place,
    credentialId: original.credentialId,
    publicKey: patch.publicKey ?? original.publicKey,
    anchorGeneration: original.anchorGeneration,
    anchor: patch.anchor ?? original.anchor ?? new Uint8Array(32),
    endorsedGeneration: patch.endorsedGeneration ?? original.endorsedGeneration,
    endorsement: patch.endorsement ?? original.endorsement,
  });

const flipped = (input: Uint8Array, index: number) => {
  const copy = input.slice();
  copy[index] = (copy[index] ?? 0) ^ 1;

  return copy;
};

/**
 * Seals a root key to a statement's public key the way the server could, without the endorsement
 * check that `Wrapper.seal` runs.
 */
const serverSeal = (statement: Wrapper.Statement, keys: AccountKey.Keys) =>
  Effect.gen(function* () {
    const suite = yield* CryptoSuite.Service;

    const info = yield* Effect.fromResult(
      Wrapper.sealInfo(keys.accountId, statement.id, keys.generation),
    );

    const { sharedSecret, enc } = yield* suite.kem.encapsulate(statement.publicKey);
    const k = yield* suite.hkdf({ ikm: sharedSecret, salt: new Uint8Array(0), info, length: 32 });
    const nonce = bytes(9, 12);

    const ct = Bytes.concat(
      nonce,
      yield* suite.aead.seal(k, nonce, Redacted.value(keys.rootKey), info),
    );

    return new Wrapper.Seal({
      format: 1,
      suite: 1,
      wrapperId: statement.id,
      accountId: keys.accountId,
      generation: keys.generation,
      enc,
      ct,
    });
  });

describe("derive", () => {
  it.effect("binds a wrapper's key pair to its kind and account", () =>
    Effect.gen(function* () {
      const derived = yield* Effect.forEach(
        [
          ["code", "acc-lena"],
          ["prf", "acc-lena"],
          ["code", "acc-tom"],
        ] as const,
        ([kind, accountId]) => Wrapper.derive(kind, secret(3), accountId),
      );

      assert.strictEqual(new Set(derived.map(({ publicKey }) => Hex.encode(publicKey))).size, 3);
    }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );
});

describe("open", () => {
  it.effect("fails with WrongSecret for another secret, generation, wrapper or account", () =>
    Effect.gen(function* () {
      const { keys0 } = yield* account;

      const tags = yield* Effect.forEach(methods, ([method, fill, length]) =>
        Effect.gen(function* () {
          const { seal } = yield* Wrapper.create(method, secret(fill, length), keys0);
          const { seed } = yield* Wrapper.derive(method.kind, secret(fill, length), "acc-lena");
          const other = yield* Wrapper.derive(method.kind, secret(99, length), "acc-lena");

          return yield* Effect.forEach(
            [
              Wrapper.open(seal, "acc-lena", method.id, other.seed),
              Wrapper.open(withSeal(seal, { generation: 1 }), "acc-lena", method.id, seed),
              Wrapper.open(seal, "acc-lena", "w-other", seed),
              Wrapper.open(seal, "acc-tom", method.id, seed),
            ],
            tag,
          );
        }),
      );

      assert.deepStrictEqual(new Set(tags.flat()), new Set(["E2ee.WrongSecret"]));
    }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );

  // Bytes 1088 to 1119 are X-Wing's X25519 half. Zeroed, it is a low-order point the KEM refuses.
  it.effect(
    "fails typed for a flipped bit or a zeroed X25519 half in the encapsulation or ciphertext",
    () =>
      Effect.gen(function* () {
        const { keys0 } = yield* account;
        const { seal } = yield* Wrapper.create(card, secret(3, 16), keys0);
        const { seed } = yield* Wrapper.derive("code", secret(3, 16), "acc-lena");
        const zeroed = seal.enc.slice();
        zeroed.fill(0, 1088);

        const changed = [
          withSeal(seal, { enc: zeroed }),
          ...Array.from({ length: 32 }, (_, index) =>
            withSeal(seal, { enc: flipped(seal.enc, 1088 + index) }),
          ),
          // X-Wing takes 9 ms to decapsulate in Node, so the ML-KEM half gets every 70th byte.
          ...Array.from({ length: 16 }, (_, index) =>
            withSeal(seal, { enc: flipped(seal.enc, index * 68) }),
          ),
          ...Array.from({ length: seal.ct.length }, (_, index) =>
            withSeal(seal, { ct: flipped(seal.ct, index) }),
          ),
        ];

        const tags = yield* Effect.forEach(changed, (tampered) =>
          tag(Wrapper.open(tampered, "acc-lena", card.id, seed)),
        );

        assert.strictEqual(tags[0], "E2ee.Malformed");
        assert.isTrue(
          tags.every((name) => name === "E2ee.Malformed" || name === "E2ee.WrongSecret"),
        );
      }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );
});

describe("recover", () => {
  it.effect("opens the newest root key with a code after a renewal re-endorsed the card", () =>
    Effect.gen(function* () {
      const { keys0, record0, keys1, record1 } = yield* account;
      const { statement } = yield* Wrapper.create(card, secret(3, 16), keys0);
      const kept = yield* Wrapper.reendorse(statement, record0, keys1);
      const seal = yield* Wrapper.seal(kept, keys1);

      const keys = yield* Wrapper.recover("code", secret(3, 16), "acc-lena", kept, seal, [
        record0,
        record1,
      ]);

      assert.isTrue(AccountKey.matches(keys, record1));
    }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );

  it.effect(
    "refuses a planted key, a forged anchor, an old endorsement, an old seal and a gap",
    () =>
      Effect.gen(function* () {
        const { keys0, record0, keys1, record1 } = yield* account;
        const { statement, seal: old } = yield* Wrapper.create(card, secret(3, 16), keys0);
        const kept = yield* Wrapper.reendorse(statement, record0, keys1);
        const current = yield* Wrapper.seal(kept, keys1);
        const records = [record0, record1];

        // The server holds every public key, so it can seal a root key of its own choosing.
        const planted = yield* serverSeal(
          kept,
          yield* AccountKey.derive(secret(66), "acc-lena", 1),
        );

        const anchor = flipped(kept.anchor ?? new Uint8Array(32), 0);

        const recover = (candidate: Wrapper.Statement, seal: Wrapper.Seal, chain = records) =>
          tag(Wrapper.recover("code", secret(3, 16), "acc-lena", candidate, seal, chain));

        assert.deepStrictEqual(
          [
            yield* recover(kept, planted),
            yield* recover(withStatement(kept, { anchor }), current),
            yield* recover(statement, current),
            yield* recover(kept, old),
            yield* recover(kept, current, [record1]),
          ],
          ["rootKey", "anchor", "signature", "chain", "chain"],
        );
      }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );

  it.effect(
    "refuses another card, and a card for another account, before trusting the server",
    () =>
      Effect.gen(function* () {
        const { keys0, record0 } = yield* account;
        const { statement, seal } = yield* Wrapper.create(card, secret(3, 16), keys0);

        assert.deepStrictEqual(
          [
            yield* tag(
              Wrapper.recover("code", secret(4, 16), "acc-lena", statement, seal, [record0]),
            ),
            yield* tag(
              Wrapper.recover("code", secret(3, 16), "acc-tom", statement, seal, [record0]),
            ),
          ],
          ["E2ee.WrongSecret", "E2ee.WrongSecret"],
        );
      }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );
});

// The review's attack: a thief holds generation 1's root key, the server plays along, and after
// the account renewed to generation 2 the thief adds a card endorsed with the old identity key.
describe("a wrapper planted with an older generation's key", () => {
  it.effect("gets no seal, isn't kept by the next renewal and recovers nothing", () =>
    Effect.gen(function* () {
      const { record0, keys1, record1, keys2, record2 } = yield* account;
      const { statement } = yield* Wrapper.create(card, secret(7, 16), keys1);
      const seal = yield* serverSeal(statement, keys2);

      assert.deepStrictEqual(
        [
          yield* Wrapper.verify(statement, record2),
          yield* tag(Wrapper.seal(statement, keys2)),
          yield* tag(Wrapper.reendorse(statement, record2, keys2)),
          yield* tag(
            Wrapper.recover("code", secret(7, 16), "acc-lena", statement, seal, [
              record0,
              record1,
              record2,
            ]),
          ),
        ],
        [false, "signature", "signature", "signature"],
      );
    }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );
});

describe("a statement of a kind this build doesn't know", () => {
  it.effect("is unsupported, never forged, so a renewal doesn't revoke it", () =>
    Effect.gen(function* () {
      const { keys0, record0 } = yield* account;
      const { statement, seal } = yield* Wrapper.create(card, secret(3, 16), keys0);
      const shamir = withStatement(statement, { kind: 4 });

      assert.deepStrictEqual(
        [
          yield* tag(Wrapper.verify(shamir, record0)),
          yield* tag(Wrapper.seal(shamir, keys0)),
          yield* tag(Wrapper.recover("code", secret(3, 16), "acc-lena", shamir, seal, [record0])),
        ],
        ["E2ee.Unsupported", "E2ee.Unsupported", "E2ee.Unsupported"],
      );
    }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );
});

describe("renewed", () => {
  it.effect("lets a device that held generation 0 pick up generation 1 from its own seal", () =>
    Effect.gen(function* () {
      const { keys0, record0, keys1, record1 } = yield* account;
      const { statement } = yield* Wrapper.create(device, secret(1), keys0);
      const kept = yield* Wrapper.reendorse(statement, record0, keys1);
      const renewal = yield* Wrapper.seal(kept, keys1);

      const keys = yield* Wrapper.renewed(secret(1), device.id, record0, renewal, [
        record0,
        record1,
      ]);

      assert.isTrue(AccountKey.matches(keys, record1));
    }).pipe(Effect.provide(TestCrypto.layer("Wrapper.test"))),
  );
});
