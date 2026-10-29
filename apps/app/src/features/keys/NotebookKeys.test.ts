import { assert, describe, it } from "@effect/vitest";
import { Keys } from "@stu/api/Keys";
import { AccountKey, type CryptoSuite, RecoveryCode, Wrapper } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import { Ports } from "@stu/sync/client";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { Device } from "../../infra/device/Device.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { MemoryKeychain } from "../../infra/keychain/MemoryKeychain.ts";
import { KeyServer } from "./KeyServer.ts";
import { NotebookKeys } from "./NotebookKeys.ts";

const account = "lena";

interface Stored {
  readonly records: ReadonlyArray<AccountKey.Record>;
  readonly wrappers: ReadonlyArray<Keys.Sealed>;
}

const samePublicKeys = (a: AccountKey.Record, b: AccountKey.Record) =>
  a.signingKey.every((byte, index) => byte === b.signingKey[index]) &&
  a.sealingKey.every((byte, index) => byte === b.sealingKey[index]);

const since = DateTime.makeUnsafe("2026-10-29T12:00:00Z");

/**
 * The server's keys in memory, answering as `KeyStore` does for one account. `seals` replaces what
 * a fetch answers, the way a server that plants a key would.
 */
const fakeServer = Effect.gen(function* () {
  const stored = yield* Ref.make<Stored>({ records: [], wrappers: [] });
  const seals = yield* Ref.make(Option.none<ReadonlyArray<Keys.Sealed>>());
  // A stale read: `state` answers no records while `init` still sees them.
  const hideRecords = yield* Ref.make(false);

  const server = KeyServer.Service.of({
    state: Effect.map(
      Effect.all([Ref.get(stored), Ref.get(hideRecords)]),
      ([{ records, wrappers }, hidden]) =>
        new Keys.State({
          records: hidden ? [] : records,
          wrappers: wrappers.map(
            ({ statement }) => new Keys.Listed({ statement, createdAt: since }),
          ),
        }),
    ),
    init: (record, wrapper) =>
      Effect.flatMap(Ref.get(stored), ({ records, wrappers }) => {
        const [zero] = records;

        if (zero !== undefined && !samePublicKeys(zero, record)) {
          return Effect.fail(new Keys.ChainExists());
        }

        return Ref.set(stored, { records: [record], wrappers: [...wrappers, wrapper] });
      }),
    addWrapper: (wrapper) =>
      Ref.update(stored, ({ records, wrappers }) => ({
        records,
        wrappers: [...wrappers, wrapper],
      })),
    fetchSeals: (method) =>
      Effect.gen(function* () {
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
  });

  return { server, stored, seals, hideRecords };
});

type FakeServer = Effect.Success<typeof fakeServer>;

/** One device of Lena's: its own secrets, a keyring that keeps what it unlocked, and the server. */
const device = (server: FakeServer, publicComputer = false) =>
  Effect.gen(function* () {
    const unlocked = yield* Ref.make<ReadonlyArray<AccountKey.Keys>>([]);

    const keyring = Layer.effect(NotebookKeys.Keyring)(
      Effect.map(Ports.DeviceSecrets, (secrets) =>
        NotebookKeys.Keyring.of({
          unlock: (keys) =>
            Effect.andThen(
              secrets.set("root-key", Redacted.value(keys.rootKey)),
              Ref.update(unlocked, (all) => [...all, keys]),
            ),
        }),
      ),
    );

    const session = Layer.succeed(Ports.Session)({
      accountId: account,
      token: Effect.succeedNone,
      changes: Stream.empty,
      ended: Effect.void,
    });

    const context = yield* Layer.build(
      Layer.mergeAll(keyring, session, Device.layer({ name: "test", publicComputer })).pipe(
        Layer.provideMerge(Keychain.secrets("test")),
        Layer.provideMerge(MemoryKeychain.layer()),
        Layer.provideMerge(Layer.succeed(KeyServer.Service)(server.server)),
      ),
    );

    const run = <A, E>(
      effect: Effect.Effect<
        A,
        E,
        | NotebookKeys.Keyring
        | Ports.Session
        | Ports.DeviceSecrets
        | Device.Service
        | KeyServer.Service
        | CryptoSuite.Service
      >,
    ) => Effect.provide(effect, context);

    const rootKey = run(
      Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("root-key")),
    ).pipe(Effect.map(Option.map((bytes) => [...bytes].join(","))));

    return { run, unlocked, rootKey };
  });

/** The reason a key operation was refused, or the tag of any other failure. */
const reasonOf = <A, R>(
  effect: Effect.Effect<A, NotebookKeys.Problem | Ports.SecretsUnavailable, R>,
) =>
  Effect.map(Effect.flip(effect), (error) =>
    error._tag === "NotebookKeys.Problem" ? error.reason : error._tag,
  );

describe("NotebookKeys", () => {
  it.effect(
    "the first device starts the key, and a second device opens it with the Notfallkarte",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const laptop = yield* device(server);

        const first = yield* phone.run(NotebookKeys.status);
        const code = Redacted.value(yield* phone.run(NotebookKeys.createRecoveryCode));
        const locked = yield* laptop.run(NotebookKeys.status);

        const typo = yield* reasonOf(
          laptop.run(NotebookKeys.unlockWithCode(`${code.slice(0, -1)}X`)),
        );

        yield* laptop.run(NotebookKeys.unlockWithCode(code.toLowerCase()));
        // As the account's key status does once the device holds its key.
        yield* laptop.run(NotebookKeys.reconcile);

        const { records, wrappers } = yield* Ref.get(server.stored);
        const [record] = records;
        const [opened] = yield* Ref.get(laptop.unlocked);

        assert.deepStrictEqual(
          {
            first: first._tag,
            locked: locked._tag,
            typo,
            laptop: (yield* laptop.run(NotebookKeys.status))._tag,
            sameKey: Option.getOrUndefined(yield* laptop.rootKey),
            kinds: wrappers.map(({ statement }) => statement.kind),
          },
          {
            first: "Unlocked",
            locked: "Locked",
            typo: "typo",
            laptop: "Unlocked",
            sameKey: Option.getOrUndefined(yield* phone.rootKey),
            kinds: [Wrapper.kindByte.device, Wrapper.kindByte.code, Wrapper.kindByte.device],
          },
        );
        assert.isTrue(
          opened !== undefined && record !== undefined && AccountKey.matches(opened, record),
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  it.effect(
    "refuses a root key the server sealed to the card itself, and a forged anchor, and keeps nothing",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const laptop = yield* device(server);
        yield* phone.run(NotebookKeys.status);
        const code = yield* phone.run(NotebookKeys.createRecoveryCode);
        const { wrappers } = yield* Ref.get(server.stored);
        const card = wrappers.find(({ statement }) => statement.kind === Wrapper.kindByte.code);

        if (card === undefined) return yield* Effect.die("The card wasn't stored");

        // The server holds the card's public key, so it can seal a root key of its own to it.
        const bytes = yield* Effect.fromResult(RecoveryCode.parse(Redacted.value(code)));
        const own = Redacted.make(new Uint8Array(32).fill(66));
        const planted = yield* AccountKey.derive(own, account, 0);

        const method = {
          id: card.statement.id,
          kind: "code",
          place: "card",
          credentialId: "",
        } as const;

        const plantedSeal = (yield* Wrapper.create(method, bytes, planted)).seal;

        const anchor = (card.statement.anchor ?? new Uint8Array(32)).slice();
        anchor[0] = (anchor[0] ?? 0) ^ 1;

        const { statement } = card;

        const forged = new Wrapper.Statement({
          format: statement.format,
          suite: statement.suite,
          id: statement.id,
          accountId: statement.accountId,
          kind: statement.kind,
          place: statement.place,
          credentialId: statement.credentialId,
          publicKey: statement.publicKey,
          anchorGeneration: statement.anchorGeneration,
          anchor,
          endorsedGeneration: statement.endorsedGeneration,
          endorsement: statement.endorsement,
        });

        yield* Ref.set(
          server.seals,
          Option.some([new Keys.Sealed({ statement: card.statement, seal: plantedSeal })]),
        );

        const plantedKey = yield* reasonOf(
          laptop.run(NotebookKeys.unlockWithCode(Redacted.value(code))),
        );

        yield* Ref.set(
          server.seals,
          Option.some([new Keys.Sealed({ statement: forged, seal: card.seal })]),
        );

        const forgedAnchor = yield* reasonOf(
          laptop.run(NotebookKeys.unlockWithCode(Redacted.value(code))),
        );

        assert.deepStrictEqual(
          {
            plantedKey,
            forgedAnchor,
            kept: Option.isNone(yield* laptop.rootKey),
            unlocked: (yield* Ref.get(laptop.unlocked)).length,
          },
          { plantedKey: "untrusted", forgedAnchor: "untrusted", kept: true, unlocked: 0 },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );
  it.effect(
    "a device that holds its key publishes its own generation 0 again, and never takes another chain, listed or answered as ChainExists",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        yield* phone.run(NotebookKeys.status);
        const [record] = (yield* Ref.get(server.stored)).records;
        const held = yield* phone.rootKey;

        // A restore lost the chain, so the phone publishes its own again, from its own key.
        yield* Ref.set(server.stored, { records: [], wrappers: [] });
        yield* phone.run(NotebookKeys.reconcile);
        const [republished] = (yield* Ref.get(server.stored)).records;

        // Another device's chain got there first. The phone keeps its key and adopts nothing.
        const other = yield* device(server);
        yield* Ref.set(server.stored, { records: [], wrappers: [] });
        yield* other.run(NotebookKeys.status);
        yield* phone.run(NotebookKeys.reconcile);
        yield* Ref.set(server.hideRecords, true);
        yield* phone.run(NotebookKeys.reconcile);
        yield* Ref.set(server.hideRecords, false);

        assert.isTrue(
          record !== undefined && republished !== undefined && samePublicKeys(record, republished),
        );
        assert.deepStrictEqual(
          {
            held: Option.getOrUndefined(yield* phone.rootKey),
            unlocks: (yield* Ref.get(phone.unlocked)).length,
            status: (yield* phone.run(NotebookKeys.status))._tag,
            stale: yield* reasonOf(phone.run(NotebookKeys.createRecoveryCode)),
          },
          { held: Option.getOrUndefined(held), unlocks: 1, status: "Unlocked", stale: "stale" },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  it.effect(
    "Notizbuch-Schlüssel counts only what the server holds and the newest generation endorses",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        yield* phone.run(NotebookKeys.status);
        const alone = yield* phone.run(NotebookKeys.summary);
        yield* phone.run(NotebookKeys.createRecoveryCode);
        const withCard = yield* phone.run(NotebookKeys.summary);
        const { records, wrappers } = yield* Ref.get(server.stored);
        const [own, card] = wrappers;

        if (own === undefined || card === undefined) return yield* Effect.die("Missing wrappers");

        // A card endorsed by a key that isn't the account's, and the real card lost in a restore.
        const stranger = yield* AccountKey.derive(
          Redacted.make(new Uint8Array(32).fill(9)),
          account,
          0,
        );

        const code = Redacted.make(new Uint8Array(16).fill(4));
        const method = { id: "planted", kind: "code", place: "card", credentialId: "" } as const;
        const planted = new Keys.Sealed(yield* Wrapper.create(method, code, stranger));
        yield* Ref.set(server.stored, { records, wrappers: [own, planted] });
        const restored = yield* phone.run(NotebookKeys.summary);

        assert.deepStrictEqual(
          [alone, withCard, restored].map(({ secured, methods }) => ({
            secured,
            methods: methods.map(({ kind, thisDevice }) => `${kind}${thisDevice ? " here" : ""}`),
          })),
          [
            { secured: false, methods: ["device here"] },
            { secured: true, methods: ["device here", "code"] },
            { secured: false, methods: ["device here"] },
          ],
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  it.effect("a public computer starts no notebook key and keeps no device seed", () =>
    Effect.gen(function* () {
      const server = yield* fakeServer;
      const kiosk = yield* device(server, true);
      const first = yield* kiosk.run(NotebookKeys.status);
      const phone = yield* device(server);
      yield* phone.run(NotebookKeys.status);
      const code = Redacted.value(yield* phone.run(NotebookKeys.createRecoveryCode));
      yield* kiosk.run(NotebookKeys.unlockWithCode(code));

      const seed = yield* kiosk.run(
        Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("device-seed")),
      );

      assert.deepStrictEqual(
        {
          first: first._tag,
          unlocked: (yield* kiosk.run(NotebookKeys.status))._tag,
          seed: Option.isNone(seed),
          devices: (yield* Ref.get(server.stored)).wrappers.filter(
            ({ statement }) => statement.kind === Wrapper.kindByte.device,
          ).length,
        },
        { first: "NotHere", unlocked: "Unlocked", seed: true, devices: 1 },
      );
    }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // recovery.md section 4: a synced passkey may give another output on another device.
  it.effect(
    "a passkey that gives a new output heals with a second wrapper, and a new device opens with it",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const laptop = yield* device(server);
        const outputA = Option.some(Redacted.make(new Uint8Array(32).fill(1)));
        const outputB = Option.some(Redacted.make(new Uint8Array(32).fill(2)));
        yield* phone.run(NotebookKeys.status);
        yield* phone.run(NotebookKeys.usePasskey("cred-1", outputA));
        yield* phone.run(NotebookKeys.usePasskey("cred-1", outputA));
        const before = yield* reasonOf(laptop.run(NotebookKeys.usePasskey("cred-1", outputB)));
        yield* phone.run(NotebookKeys.usePasskey("cred-1", outputB));
        yield* laptop.run(NotebookKeys.usePasskey("cred-1", outputB));

        assert.deepStrictEqual(
          {
            before,
            passkeyWrappers: (yield* Ref.get(server.stored)).wrappers.filter(
              ({ statement }) => statement.kind === Wrapper.kindByte.prf,
            ).length,
            laptop: Option.getOrUndefined(yield* laptop.rootKey),
          },
          {
            before: "passkey-no-match",
            passkeyWrappers: 2,
            laptop: Option.getOrUndefined(yield* phone.rootKey),
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  it.effect("a passkey unlocks a device again after the account renewed its key elsewhere", () =>
    Effect.gen(function* () {
      const server = yield* fakeServer;
      const phone = yield* device(server);
      const output = Option.some(Redacted.make(new Uint8Array(32).fill(1)));
      yield* phone.run(NotebookKeys.status);
      yield* phone.run(NotebookKeys.usePasskey("cred-1", output));
      const [old] = yield* Ref.get(phone.unlocked);
      const { records, wrappers } = yield* Ref.get(server.stored);
      const [record0] = records;

      if (old === undefined || record0 === undefined) return yield* Effect.die("No key");

      // Another device renewed the key to generation 1 and sealed it to every wrapper.
      const keys1 = yield* AccountKey.derive(Redacted.make(new Uint8Array(32).fill(7)), account, 1);
      const record1 = yield* AccountKey.record(keys1, { keys: old, record: record0 });

      const renewed = yield* Effect.forEach(wrappers, ({ statement }) =>
        Effect.gen(function* () {
          const kept = yield* Wrapper.reendorse(statement, record0, keys1);

          return new Keys.Sealed({ statement: kept, seal: yield* Wrapper.seal(kept, keys1) });
        }),
      );

      yield* Ref.set(server.stored, { records: [record0, record1], wrappers: renewed });
      const stale = yield* reasonOf(phone.run(NotebookKeys.createRecoveryCode));
      yield* phone.run(NotebookKeys.usePasskey("cred-1", output));
      const latest = (yield* Ref.get(phone.unlocked)).at(-1);

      assert.deepStrictEqual(
        {
          stale,
          renewed: latest !== undefined && AccountKey.matches(latest, record1),
          secured: (yield* phone.run(NotebookKeys.summary)).secured,
        },
        { stale: "stale", renewed: true, secured: true },
      );
    }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );
});
