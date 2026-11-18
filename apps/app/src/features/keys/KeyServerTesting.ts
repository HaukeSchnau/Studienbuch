import { Keys } from "@stu/api/Keys";
import { type AccountKey, Wrapper } from "@stu/e2ee";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";

import { KeyServer } from "./KeyServer.ts";

// The server's keys in memory for tests, answering as `KeyStore` does for one account.

export * as KeyServerTesting from "./KeyServerTesting.ts";

export interface Stored {
  readonly records: ReadonlyArray<AccountKey.Record>;
  readonly wrappers: ReadonlyArray<Keys.Sealed>;
}

/** Whether two records hold the same public keys. */
export const samePublicKeys = (a: AccountKey.Record, b: AccountKey.Record) =>
  a.signingKey.every((byte, index) => byte === b.signingKey[index]) &&
  a.sealingKey.every((byte, index) => byte === b.sealingKey[index]);

const since = DateTime.makeUnsafe("2026-10-29T12:00:00Z");

/**
 * The server's keys in memory, answering as `KeyStore` does for one account. `seals` replaces what
 * a fetch answers, the way a server that plants a key would.
 */
export const make = Effect.gen(function* () {
  const stored = yield* Ref.make<Stored>({ records: [], wrappers: [] });
  const seals = yield* Ref.make(Option.none<ReadonlyArray<Keys.Sealed>>());
  // A stale read: `state` answers no records while `init` still sees them.
  const hideRecords = yield* Ref.make(false);
  // The next `init` or `addWrapper` takes effect, and its answer is lost on the way back.
  const loseAnswer = yield* Ref.make(false);
  // The key the account's notebook was sealed with, which the server knows by its key boxes.
  const sealedWith = yield* Ref.make(Option.none<AccountKey.Record>());
  // The root key the server derives for a demo account, and how often a device asked for it.
  const demoKey = yield* Ref.make(Option.none<Redacted.Redacted<Uint8Array>>());
  const demoAsked = yield* Ref.make(0);
  // `state` doesn't answer, as without a network.
  const offline = yield* Ref.make(false);
  // The login each `addWrapper` carried, which only a card's has.
  const logins = yield* Ref.make<ReadonlyArray<Option.Option<string>>>([]);

  const answer = <A, E>(effect: Effect.Effect<A, E>) =>
    Effect.flatMap(effect, (value) =>
      Effect.flatMap(Ref.getAndSet(loseAnswer, false), (lost) =>
        lost ? Effect.fail(new KeyServer.Unreachable()) : Effect.succeed(value),
      ),
    );

  // As `KeyStore` keeps them: one wrapper per id, so sending one again changes nothing.
  const withWrapper = (wrappers: ReadonlyArray<Keys.Sealed>, wrapper: Keys.Sealed) =>
    wrappers.some(({ statement }) => statement.id === wrapper.statement.id)
      ? wrappers
      : [...wrappers, wrapper];

  const server = KeyServer.Service.of({
    state: Effect.flatMap(
      Effect.all([Ref.get(stored), Ref.get(hideRecords), Ref.get(offline)]),
      ([{ records, wrappers }, hidden, away]) =>
        away
          ? Effect.fail(new KeyServer.Unreachable())
          : Effect.succeed(
              new Keys.State({
                records: hidden ? [] : records,
                wrappers: wrappers.map(
                  ({ statement }) => new Keys.Listed({ statement, createdAt: since }),
                ),
              }),
            ),
    ),
    init: (record, wrapper) =>
      Effect.flatMap(
        Effect.all([Ref.get(stored), Ref.get(sealedWith)]),
        ([{ records, wrappers }, sealer]): ReturnType<KeyServer.Service["Service"]["init"]> => {
          const [zero] = records;

          if (zero !== undefined && !samePublicKeys(zero, record)) {
            return Effect.fail(new Keys.ChainExists());
          }

          if (
            zero === undefined &&
            Option.exists(sealer, (sealed) => !samePublicKeys(sealed, record))
          ) {
            return Effect.fail(new Keys.KeysLost());
          }

          return answer(
            Ref.set(stored, {
              records: zero === undefined ? [record] : records,
              wrappers: withWrapper(wrappers, wrapper),
            }),
          );
        },
      ),
    addWrapper: (wrapper, login) =>
      Effect.andThen(
        Ref.update(logins, (all) => [...all, Option.map(login, Redacted.value)]),
        answer(
          Ref.update(stored, ({ records, wrappers }) => ({
            records,
            wrappers: withWrapper(wrappers, wrapper),
          })),
        ),
      ),
    fetchSeals: Effect.fn("KeyServerTesting.fetchSeals")(function* (method: Keys.Method) {
      const { records, wrappers } = yield* Ref.get(stored);
      const kind = method._tag === "Passkey" ? Wrapper.kindByte.prf : Wrapper.kindByte.code;

      const found = wrappers.filter(
        ({ statement }) =>
          statement.kind === kind &&
          (method._tag !== "Passkey" || statement.credentialId === method.credentialId),
      );

      const answered = Option.getOrElse(yield* Ref.get(seals), () => found);

      return new Keys.Seals({ records, wrappers: answered });
    }),
    demoRootKey: Effect.andThen(
      Ref.update(demoAsked, (count) => count + 1),
      Ref.get(demoKey),
    ),
  });

  return {
    server,
    stored,
    seals,
    hideRecords,
    loseAnswer,
    sealedWith,
    demoKey,
    demoAsked,
    offline,
    logins,
  };
});

export type Fake = Effect.Success<typeof make>;
