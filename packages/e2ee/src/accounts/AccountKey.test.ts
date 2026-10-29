import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Redacted from "effect/Redacted";

import { TestCrypto } from "../testing/TestCrypto.ts";
import { AccountKey } from "./AccountKey.ts";

const rootKey = (fill: number) => Redacted.make(new Uint8Array(32).fill(fill));

const tag = <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.map(Effect.flip(effect), ({ _tag }) => _tag);

/** Generations 0 to 2 of one account, each linked from the one before. */
const chain = Effect.gen(function* () {
  const keys = yield* Effect.forEach([0, 1, 2], (generation) =>
    AccountKey.derive(rootKey(generation + 1), "acc-lena", generation),
  );

  const [keys0, keys1, keys2] = keys;

  if (keys0 === undefined || keys1 === undefined || keys2 === undefined) {
    return yield* Effect.die("three generations");
  }

  const record0 = yield* AccountKey.record(keys0, "first");
  const record1 = yield* AccountKey.record(keys1, { keys: keys0, record: record0 });
  const record2 = yield* AccountKey.record(keys2, { keys: keys1, record: record1 });

  return { keys0, keys1, keys2, record0, record1, record2 };
});

describe("derive", () => {
  it.effect("gives every generation and every account its own keys from one root key", () =>
    Effect.gen(function* () {
      const derived = yield* Effect.forEach(
        [
          ["acc-lena", 0],
          ["acc-lena", 1],
          ["acc-tom", 0],
        ] as const,
        ([account, generation]) => AccountKey.derive(rootKey(9), account, generation),
      );

      const signing = new Set(derived.map(({ signingKey }) => Hex.encode(signingKey)));
      const sealing = new Set(derived.map(({ sealingKey }) => Hex.encode(sealingKey)));
      assert.deepStrictEqual([signing.size, sealing.size], [3, 3]);
    }).pipe(Effect.provide(TestCrypto.layer("AccountKey.test"))),
  );
});

describe("verifyChain", () => {
  it.effect("walks from a trusted record to the newest one", () =>
    Effect.gen(function* () {
      const { record0, record1, record2 } = yield* chain;
      const newest = yield* AccountKey.verifyChain(record0, [record2, record0, record1]);
      assert.strictEqual(newest.generation, 2);
    }).pipe(Effect.provide(TestCrypto.layer("AccountKey.test"))),
  );

  it.effect("refuses a gap, a link by a foreign key, a fork and a reset in between", () =>
    Effect.gen(function* () {
      const { keys0, keys1, keys2, record0, record1, record2 } = yield* chain;
      const intruder = yield* AccountKey.derive(rootKey(77), "acc-lena", 0);
      const intruderRecord = yield* AccountKey.record(intruder, "first");

      // A server that holds no identity key can only sign a successor with a key of its own.
      const forged = yield* AccountKey.record(keys1, { keys: intruder, record: intruderRecord });
      const forkAt1 = yield* AccountKey.derive(rootKey(78), "acc-lena", 1);
      const forkRecord = yield* AccountKey.record(forkAt1, { keys: keys0, record: record0 });
      const reset = yield* AccountKey.record(keys1, "reset");
      const afterReset = yield* AccountKey.record(keys2, { keys: keys1, record: reset });

      const tags = yield* Effect.forEach(
        [
          [record0, record2],
          [forged, record2],
          [record1, forkRecord, record2],
          [reset, afterReset],
        ],
        (records) => tag(AccountKey.verifyChain(record0, records)),
      );

      assert.deepStrictEqual(
        tags,
        Array.from({ length: 4 }, () => "E2ee.Untrusted"),
      );
      // A reset starts a chain of its own, which devices trust from the reset record on.
      assert.strictEqual((yield* AccountKey.verifyChain(reset, [afterReset])).generation, 2);
    }).pipe(Effect.provide(TestCrypto.layer("AccountKey.test"))),
  );
});

const changedRecord = (original: AccountKey.Record, patch: Partial<AccountKey.Record>) =>
  new AccountKey.Record({
    format: patch.format ?? original.format,
    suite: original.suite,
    accountId: original.accountId,
    generation: original.generation,
    reset: original.reset,
    signingKey: original.signingKey,
    sealingKey: patch.sealingKey ?? original.sealingKey,
    signature: original.signature,
  });

describe("verify", () => {
  it.effect("refuses a record whose sealing key changed or can't be sealed to", () =>
    Effect.gen(function* () {
      const { keys2, record1 } = yield* chain;
      const lowOrder = record1.sealingKey.slice();
      lowOrder.fill(0, 1184);

      assert.deepStrictEqual(
        [
          yield* AccountKey.verify(changedRecord(record1, { sealingKey: keys2.sealingKey })),
          yield* AccountKey.verify(changedRecord(record1, { sealingKey: lowOrder })),
        ],
        [false, false],
      );
    }).pipe(Effect.provide(TestCrypto.layer("AccountKey.test"))),
  );

  // An app that can't read a newer record must ask for an update, not rotate away from it.
  it.effect("reports a newer format as unsupported, not as forged", () =>
    Effect.gen(function* () {
      const { record1 } = yield* chain;
      const error = yield* Effect.flip(AccountKey.verify(changedRecord(record1, { format: 2 })));

      assert.strictEqual(error._tag, "E2ee.Unsupported");
    }).pipe(Effect.provide(TestCrypto.layer("AccountKey.test"))),
  );
});
