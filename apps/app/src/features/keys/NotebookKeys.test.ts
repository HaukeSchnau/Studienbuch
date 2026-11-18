import { assert, describe, it } from "@effect/vitest";
import { Keys } from "@stu/api/Keys";
import { AccountKey, type CryptoSuite, RecoveryCode, Wrapper } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { DeviceSessions } from "../../infra/keychain/DeviceSessions.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { MemoryKeychain } from "../../infra/keychain/MemoryKeychain.ts";
import { KeyServer } from "./KeyServer.ts";
import { KeyServerTesting } from "./KeyServerTesting.ts";
import { NotebookKeys } from "./NotebookKeys.ts";

const account = "lena";

type FakeServer = KeyServerTesting.Fake;

const fakeServer = KeyServerTesting.make;

/** A card typed to sign in, which the student has. */
const typed = (code: Redacted.Redacted<Uint8Array>) =>
  NotebookKeys.takeCard({ code, endsAtSaved: false, unsaved: false });

/** A new account's card, which the card step shows. */
const fresh = (code: Redacted.Redacted<Uint8Array>, endsAtSaved = false) =>
  NotebookKeys.holdCard({ code, endsAtSaved, unsaved: true });

/** "Notfallkarte erstellen" with an answer that arrives, and the student saved it. */
const createCard = Effect.tap(NotebookKeys.replaceCard, () => NotebookKeys.cardSaved);

/** How Lena signed in on a device: `demo` at a demo account's address with a password. */
interface Setup {
  readonly publicComputer?: boolean;
  readonly demo?: boolean;
  /** Reads of secrets yield after reading, as IndexedDB and the keychain do, so steps interleave. */
  readonly slowSecrets?: boolean;
}

/** `secrets` whose reads yield after reading, so another fiber runs before the value is used. */
const slow = <E, R>(secrets: Layer.Layer<Ports.DeviceSecrets, E, R>) =>
  Layer.effect(Ports.DeviceSecrets)(
    Effect.map(Ports.DeviceSecrets, (inner) =>
      Ports.DeviceSecrets.of({
        ...inner,
        get: (name) => Effect.tap(inner.get(name), () => Effect.yieldNow),
      }),
    ),
  ).pipe(Layer.provide(secrets));

/** One device of Lena's: its own secrets, a keyring that keeps what it unlocked, and the server. */
const device = (
  server: FakeServer,
  { publicComputer = false, demo = false, slowSecrets = false }: Setup = {},
) =>
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
      ended: () => Effect.void,
    });

    const signedIn = SessionStore.layer.pipe(
      Layer.provide(DeviceSessions.layer),
      Layer.provide(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
    );

    const context = yield* Layer.build(
      Layer.mergeAll(keyring, session, signedIn, NotebookKeys.guard).pipe(
        Layer.provideMerge(
          Layer.mergeAll(
            Device.layer({ name: "test" }),
            Layer.succeed(Device.PublicComputer)(publicComputer),
          ),
        ),
        Layer.provideMerge(slowSecrets ? slow(Keychain.secrets("test")) : Keychain.secrets("test")),
        Layer.provideMerge(MemoryKeychain.layer()),
        Layer.provideMerge(Layer.succeed(KeyServer.Service)(server.server)),
      ),
    );

    const run = <A, E>(
      effect: Effect.Effect<
        A,
        E,
        | NotebookKeys.Keyring
        | NotebookKeys.Guard
        | Ports.Session
        | SessionStore.Service
        | Ports.DeviceSecrets
        | Device.PublicComputer
        | KeyServer.Service
        | CryptoSuite.Service
      >,
    ) => Effect.provide(effect, context);

    yield* run(
      Effect.flatMap(SessionStore.Service, (store) =>
        store.signedIn({ accountId: account, token: Redacted.make("token"), demo }, publicComputer),
      ),
    );

    const rootKey = run(
      Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("root-key")),
    ).pipe(Effect.map(Option.map((bytes) => [...bytes].join(","))));

    const seed = run(Effect.flatMap(Ports.DeviceSecrets, (secrets) => secrets.get("device-seed")));

    return { run, unlocked, rootKey, seed };
  });

/** The reason a key operation was refused, or the tag of any other failure. */
const reasonOf = <A, R>(
  effect: Effect.Effect<A, NotebookKeys.Problem | Ports.SecretsUnavailable, R>,
) =>
  Effect.map(Effect.flip(effect), (error) =>
    error._tag === "NotebookKeys.Problem" ? error.reason : error._tag,
  );

describe("NotebookKeys", () => {
  it("a status that failed counts as locked, and only a loading one as not known yet", () => {
    const unlocked = NotebookKeys.Status.Unlocked();
    const refused = new Ports.SecretsUnavailable({ secret: "root-key" });

    for (const [status, expected] of [
      [AsyncResult.initial(), Option.none()],
      [AsyncResult.initial(true), Option.none()],
      [AsyncResult.success(unlocked), Option.some(true)],
      [AsyncResult.success(NotebookKeys.Status.Offline()), Option.some(false)],
      [AsyncResult.fail(refused), Option.some(false)],
      [
        AsyncResult.fail(refused, { previousSuccess: Option.some(AsyncResult.success(unlocked)) }),
        Option.some(true),
      ],
    ] as const) {
      assert.deepStrictEqual(NotebookKeys.unlocked(status), expected);
    }
  });

  it.effect(
    "the first device starts the key, and a second device opens it with the Notfallkarte",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const laptop = yield* device(server);

        const first = yield* phone.run(NotebookKeys.status);
        const code = Redacted.value(yield* phone.run(createCard));
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

  // An account without an address that signed up on a public computer has a card that signs in
  // and no notebook yet. Its first own device starts the key, and the card must open it too.
  it.effect(
    "a card that signed in gets its wrapper and login on the first device, then opens the next one",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const laptop = yield* device(server);
        const { bytes: code } = yield* RecoveryCode.generate;

        yield* phone.run(NotebookKeys.status);
        yield* phone.run(typed(code));
        // A second sign-in with the same card sends nothing new.
        yield* phone.run(typed(code));

        const locked = yield* laptop.run(NotebookKeys.status);
        yield* laptop.run(typed(code));

        const { wrappers } = yield* Ref.get(server.stored);

        assert.deepStrictEqual(
          {
            logins: yield* Ref.get(server.logins),
            kinds: wrappers.map(({ statement }) => statement.kind),
            locked: locked._tag,
            laptop: (yield* laptop.run(NotebookKeys.status))._tag,
            sameKey: Option.getOrUndefined(yield* laptop.rootKey),
            left: [
              Option.isSome(yield* phone.run(NotebookKeys.pendingCard)),
              Option.isSome(yield* laptop.run(NotebookKeys.pendingCard)),
            ],
          },
          {
            logins: [Option.some(Redacted.value(yield* NotebookKeys.cardLogin(code)))],
            kinds: [Wrapper.kindByte.device, Wrapper.kindByte.code],
            locked: "Locked",
            laptop: "Unlocked",
            sameKey: Option.getOrUndefined(yield* phone.rootKey),
            left: [false, false],
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // Two key steps at once on a first device, the first one's answer lost (Sol N3): each could make
  // a key, and the second's refusal would delete the first's, which the server kept.
  it.effect(
    "two overlapping first keys with a lost answer end with one key, here and on the server",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server, { slowSecrets: true });
        yield* Ref.set(server.loseAnswer, true);

        yield* phone.run(
          Effect.all([NotebookKeys.status, NotebookKeys.status], { concurrency: "unbounded" }),
        );

        const after = yield* phone.run(NotebookKeys.status);
        const { records } = yield* Ref.get(server.stored);
        const [record] = records;
        const [opened] = yield* Ref.get(phone.unlocked);

        assert.deepStrictEqual(
          { after: after._tag, records: records.length },
          {
            after: "Unlocked",
            records: 1,
          },
        );
        assert.isTrue(
          opened !== undefined && record !== undefined && AccountKey.matches(opened, record),
          "the device holds the key the server published",
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // A new account's card is its way back as soon as its first device has the key: that device may
  // be gone before the student presses "Ich habe ihn aufgeschrieben".
  it.effect(
    "the first device's key sends the held card with its login, so the card opens the next device",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const laptop = yield* device(server);
        const { bytes: code } = yield* RecoveryCode.generate;

        yield* phone.run(fresh(code));
        // The account's key status, before the student ever presses "Ich habe ihn aufgeschrieben".
        yield* phone.run(NotebookKeys.settle);

        const locked = yield* laptop.run(NotebookKeys.status);
        yield* laptop.run(typed(code));

        // The press and the key status at once, on another account's first device.
        const other = yield* fakeServer;
        const tablet = yield* device(other);
        const { bytes: second } = yield* RecoveryCode.generate;
        yield* tablet.run(fresh(second, true));

        yield* tablet.run(
          Effect.all([NotebookKeys.settle, NotebookKeys.settle], { concurrency: "unbounded" }),
        );

        const cards = (stored: KeyServerTesting.Stored) =>
          stored.wrappers.filter(({ statement }) => statement.kind === Wrapper.kindByte.code)
            .length;

        assert.deepStrictEqual(
          {
            login: (yield* Ref.get(server.logins)).filter(Option.isSome),
            locked: locked._tag,
            laptop: (yield* laptop.run(NotebookKeys.status))._tag,
            sameKey: Option.getOrUndefined(yield* laptop.rootKey),
            cards: [cards(yield* Ref.get(server.stored)), cards(yield* Ref.get(other.stored))],
          },
          {
            login: [Option.some(Redacted.value(yield* NotebookKeys.cardLogin(code)))],
            locked: "Locked",
            laptop: "Unlocked",
            sameKey: Option.getOrUndefined(yield* phone.rootKey),
            cards: [1, 1],
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // The server took a new account's first key, and its answer was lost, so the key status says
  // Offline. "Ich habe ihn aufgeschrieben" after the network is back must not need a restart.
  it.effect(
    "saving the held card settles a first key whose answer was lost, then sends the card",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const { bytes: code } = yield* RecoveryCode.generate;
        yield* phone.run(fresh(code));
        yield* Ref.set(server.loseAnswer, true);
        const lost = yield* phone.run(NotebookKeys.status);

        // "Ich habe ihn aufgeschrieben".
        const pressed = yield* phone.run(NotebookKeys.settle);
        const { wrappers } = yield* Ref.get(server.stored);

        assert.deepStrictEqual(
          {
            lost: lost._tag,
            pressed: [pressed.status._tag, pressed.card],
            cards: wrappers.filter(({ statement }) => statement.kind === Wrapper.kindByte.code)
              .length,
            // Still unsaved: the card step goes on.
            kept: Option.map(yield* phone.run(NotebookKeys.pendingCard), (card) => card.unsaved),
          },
          {
            lost: "Offline",
            pressed: ["Unlocked", Option.none<NotebookKeys.Reason>()],
            cards: 1,
            kept: Option.some(true),
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // A public computer starts no notebook key. A passkey made there would let the student's own
  // device start the notebook without the card, which could then never open it (Sol N1).
  it.effect(
    "a card from a public computer gives the own device's new key its wrapper, and opens a third",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const kiosk = yield* device(server, { publicComputer: true });
        const own = yield* device(server);
        const third = yield* device(server);
        const { bytes: code, text } = yield* RecoveryCode.generate;
        yield* kiosk.run(fresh(code));
        const atKiosk = (yield* kiosk.run(NotebookKeys.settle)).status;
        // The read-back ends the step there; the card can do no more on a public computer.
        yield* kiosk.run(NotebookKeys.cardSaved);
        const kioskKeeps = Option.isSome(yield* kiosk.run(NotebookKeys.pendingCard));

        // The own device signs in with the card as typed, which starts the notebook's key.
        const card = yield* NotebookKeys.typedCard(Redacted.value(text));
        const started = (yield* own.run(typed(card))).status;

        const locked = yield* third.run(NotebookKeys.status);
        yield* third.run(typed(card));

        const unsaved = { code, text, endsAtSaved: false, unsaved: true, replacing: false };

        assert.deepStrictEqual(
          {
            next: [
              NotebookKeys.afterSaved(unsaved, true),
              NotebookKeys.afterSaved(unsaved, false),
              NotebookKeys.afterSaved({ ...unsaved, endsAtSaved: true }, false),
            ],
            atKiosk: atKiosk._tag,
            kioskKeeps,
            started: started._tag,
            locked: locked._tag,
            third: (yield* third.run(NotebookKeys.status))._tag,
            sameKey: Option.getOrUndefined(yield* third.rootKey),
          },
          {
            next: ["read-back", "passkey", "done"],
            atKiosk: "NotHere",
            kioskKeeps: false,
            started: "Unlocked",
            locked: "Locked",
            third: "Unlocked",
            sameKey: Option.getOrUndefined(yield* own.rootKey),
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // The card that signed in on the account's first own device waits through a first key whose
  // answer was lost, and goes out with the retry (Sol N1).
  it.effect(
    "a typed card outlives an Offline first key, goes out with the retry and opens a third device",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const own = yield* device(server);
        const third = yield* device(server);
        const { bytes: code } = yield* RecoveryCode.generate;
        yield* Ref.set(server.loseAnswer, true);

        const offline = yield* own.run(typed(code));
        const keptOffline = Option.isSome(yield* own.run(NotebookKeys.pendingCard));
        // The engine reaches the server again, and the key status runs once more.
        const retried = yield* own.run(NotebookKeys.settle);

        const locked = yield* third.run(NotebookKeys.status);
        const opened = yield* third.run(typed(code));

        assert.deepStrictEqual(
          {
            offline: [offline.status._tag, offline.card],
            keptOffline,
            retried: [retried.status._tag, retried.card],
            left: Option.isSome(yield* own.run(NotebookKeys.pendingCard)),
            locked: locked._tag,
            opened: [opened.status._tag, opened.card],
            sameKey: Option.getOrUndefined(yield* third.rootKey),
          },
          {
            offline: ["Offline", Option.some("offline")],
            keptOffline: true,
            retried: ["Unlocked", Option.none<NotebookKeys.Reason>()],
            left: false,
            locked: "Locked",
            opened: ["Unlocked", Option.none<NotebookKeys.Reason>()],
            sameKey: Option.getOrUndefined(yield* own.rootKey),
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  it.effect(
    "a demo account's devices unlock with the key the server derives for it, and publish no wrapper",
    () =>
      Effect.gen(function* () {
        // As the demo seed publishes it (ADR 0027): generation 0 and no wrapper.
        const demo = yield* fakeServer;
        const rootKey = Redacted.make(new Uint8Array(32).fill(5));
        const keys = yield* AccountKey.derive(rootKey, account, 0);
        const record = yield* AccountKey.record(keys, "first");
        yield* Ref.set(demo.stored, { records: [record], wrappers: [] });
        yield* Ref.set(demo.demoKey, Option.some(rootKey));
        const tablet = yield* device(demo, { demo: true });
        const phone = yield* device(demo, { demo: true });
        const tabletStatus = yield* tablet.run(NotebookKeys.status);
        yield* tablet.run(NotebookKeys.reconcile);
        const phoneStatus = yield* phone.run(NotebookKeys.status);
        yield* phone.run(NotebookKeys.reconcile);

        // A server that answers `NotDemo`, then a demo key that doesn't derive the record.
        const other = yield* fakeServer;
        yield* Ref.set(other.stored, { records: [record], wrappers: [] });
        const laptop = yield* device(other, { demo: true });
        const refused = yield* laptop.run(NotebookKeys.status);
        yield* Ref.set(other.demoKey, Option.some(Redacted.make(new Uint8Array(32).fill(6))));
        const wrongKey = yield* laptop.run(NotebookKeys.status);

        // The demo key, and a record of another account that it derives.
        const tomsKeys = yield* AccountKey.derive(rootKey, "tom", 0);
        const toms = yield* AccountKey.record(tomsKeys, "first");
        yield* Ref.set(other.stored, { records: [toms], wrappers: [] });
        yield* Ref.set(other.demoKey, Option.some(rootKey));
        const otherAccount = yield* laptop.run(NotebookKeys.status);

        assert.deepStrictEqual(
          {
            tablet: tabletStatus._tag,
            phone: phoneStatus._tag,
            kept: Option.getOrUndefined(yield* phone.rootKey),
            seeds: [Option.isNone(yield* tablet.seed), Option.isNone(yield* phone.seed)],
            wrappers: (yield* Ref.get(demo.stored)).wrappers.length,
            refused: refused._tag,
            wrongKey: wrongKey._tag,
            otherAccount: otherAccount._tag,
            laptopKey: Option.isNone(yield* laptop.rootKey),
            asked: [yield* Ref.get(demo.demoAsked), yield* Ref.get(other.demoAsked)],
          },
          {
            tablet: "Unlocked",
            phone: "Unlocked",
            kept: [...Redacted.value(rootKey)].join(","),
            seeds: [true, true],
            wrappers: 0,
            refused: "Locked",
            wrongKey: "Locked",
            otherAccount: "Locked",
            laptopKey: true,
            asked: [2, 3],
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // A dishonest server derives a record from a root key of its own, hides the account's device
  // wrappers and answers `Demo.rootKey` with that key.
  it.effect("takes a key from the server only after a sign-in at a demo address", () =>
    Effect.gen(function* () {
      const rootKey = Redacted.make(new Uint8Array(32).fill(7));
      const lenas = yield* AccountKey.derive(rootKey, account, 0);
      const own = yield* AccountKey.record(lenas, "first");

      const ordinary = yield* fakeServer;
      yield* Ref.set(ordinary.stored, { records: [own], wrappers: [] });
      yield* Ref.set(ordinary.demoKey, Option.some(rootKey));
      const notDemo = yield* device(ordinary);
      const planted = yield* notDemo.run(NotebookKeys.status);

      assert.deepStrictEqual(
        {
          planted: planted._tag,
          notDemoKey: Option.isNone(yield* notDemo.rootKey),
          asked: yield* Ref.get(ordinary.demoAsked),
        },
        { planted: "Locked", notDemoKey: true, asked: 0 },
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
        const code = yield* phone.run(createCard);
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
        const ownAgain = yield* phone.run(NotebookKeys.reconcile);
        const [republished] = (yield* Ref.get(server.stored)).records;

        // Another device's chain got there first. The phone keeps its key, adopts nothing and
        // says its key doesn't match the account's.
        const other = yield* device(server);
        yield* Ref.set(server.stored, { records: [], wrappers: [] });
        yield* other.run(NotebookKeys.status);
        const listed = yield* phone.run(NotebookKeys.reconcile);
        yield* Ref.set(server.hideRecords, true);
        const answered = yield* phone.run(NotebookKeys.reconcile);
        yield* Ref.set(server.hideRecords, false);

        assert.isTrue(
          record !== undefined &&
            republished !== undefined &&
            KeyServerTesting.samePublicKeys(record, republished),
        );
        assert.deepStrictEqual(
          {
            held: Option.getOrUndefined(yield* phone.rootKey),
            unlocks: (yield* Ref.get(phone.unlocked)).length,
            status: (yield* phone.run(NotebookKeys.status))._tag,
            stale: yield* reasonOf(phone.run(createCard)),
            matches: [ownAgain, listed, answered],
          },
          {
            held: Option.getOrUndefined(held),
            unlocks: 1,
            status: "Unlocked",
            stale: "stale",
            matches: [true, false, false],
          },
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
        yield* phone.run(createCard);
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

  // Lena pressed "Später": her phone holds the only copy of the key, and signing out deletes it.
  it.effect("signing out loses the notebook only where this device holds the only way in", () =>
    Effect.gen(function* () {
      const server = yield* fakeServer;
      const phone = yield* device(server);
      yield* phone.run(NotebookKeys.status);
      const alone = yield* phone.run(NotebookKeys.atSignOut);
      yield* Ref.set(server.offline, true);
      const offline = yield* phone.run(NotebookKeys.atSignOut);
      yield* Ref.set(server.offline, false);
      yield* phone.run(createCard);
      const withCard = yield* phone.run(NotebookKeys.atSignOut);
      const { records, wrappers } = yield* Ref.get(server.stored);

      // The server loses the card, as in a restore: the next check asks it again and knows.
      yield* Ref.set(server.stored, { records, wrappers: wrappers.slice(0, 1) });
      const cardLost = yield* phone.run(NotebookKeys.atSignOut);
      yield* Ref.set(server.stored, { records, wrappers });
      const laptop = yield* device(server);
      yield* laptop.run(NotebookKeys.status);
      const locked = yield* laptop.run(NotebookKeys.atSignOut);

      // A demo account's key comes from the server at every sign-in, and it has no wrapper.
      const demo = yield* fakeServer;
      const rootKey = Redacted.make(new Uint8Array(32).fill(5));
      const keys = yield* AccountKey.derive(rootKey, account, 0);
      yield* Ref.set(demo.stored, {
        records: [yield* AccountKey.record(keys, "first")],
        wrappers: [],
      });
      yield* Ref.set(demo.demoKey, Option.some(rootKey));
      const demoTablet = yield* device(demo, { demo: true });
      yield* demoTablet.run(NotebookKeys.status);
      const demoAccount = yield* demoTablet.run(NotebookKeys.atSignOut);

      // The server took a first device's key, and its answer was lost: only `pending-key` holds it.
      const unanswered = yield* fakeServer;
      yield* Ref.set(unanswered.loseAnswer, true);
      const tablet = yield* device(unanswered);
      const tabletStatus = yield* tablet.run(NotebookKeys.status);
      yield* Ref.set(unanswered.offline, true);
      const pending = yield* tablet.run(NotebookKeys.atSignOut);

      assert.deepStrictEqual(
        {
          alone,
          offline,
          withCard,
          cardLost,
          locked,
          demoAccount,
          tabletStatus: tabletStatus._tag,
          pending,
        },
        {
          alone: "lost",
          offline: "unknown",
          withCard: "kept",
          cardLost: "lost",
          locked: "kept",
          demoAccount: "kept",
          tabletStatus: "Offline",
          pending: "unknown",
        },
      );
    }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  it.effect("a public computer starts no notebook key and keeps no device seed", () =>
    Effect.gen(function* () {
      const server = yield* fakeServer;
      const kiosk = yield* device(server, { publicComputer: true });
      const first = yield* kiosk.run(NotebookKeys.status);
      const phone = yield* device(server);
      yield* phone.run(NotebookKeys.status);
      const code = Redacted.value(yield* phone.run(createCard));
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
      const stale = yield* reasonOf(phone.run(createCard));
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

  it.effect(
    "a first device whose init answer was lost unlocks on its next try with the key the server took",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        yield* Ref.set(server.loseAnswer, true);
        const lost = yield* phone.run(NotebookKeys.status);
        const heldWhileLost = yield* phone.rootKey;
        const again = yield* phone.run(NotebookKeys.status);
        const { records, wrappers } = yield* Ref.get(server.stored);
        const [record] = records;
        const [opened] = yield* Ref.get(phone.unlocked);

        assert.deepStrictEqual(
          {
            lost: lost._tag,
            heldWhileLost: Option.isNone(heldWhileLost),
            again: again._tag,
            records: records.length,
            devices: wrappers.length,
          },
          { lost: "Offline", heldWhileLost: true, again: "Unlocked", records: 1, devices: 1 },
        );
        assert.isTrue(
          opened !== undefined && record !== undefined && AccountKey.matches(opened, record),
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // A passkey sign-up starts the notebook's key with the passkey's PRF output at hand. Offline,
  // the passkey's wrapper waits on the device and goes out with the next key step, without
  // another prompt, so the passkey opens the notebook on a new device.
  it.effect("a passkey's wrapper that couldn't go out goes with the next key step", () =>
    Effect.gen(function* () {
      const server = yield* fakeServer;
      const phone = yield* device(server);
      const laptop = yield* device(server);
      const prf = Redacted.make(new Uint8Array(32).fill(9));
      yield* phone.run(NotebookKeys.status);

      yield* Ref.set(server.offline, true);

      const offline = yield* reasonOf(
        phone.run(NotebookKeys.usePasskey("credential", Option.some(prf))),
      );

      const whileOffline = (yield* phone.run(NotebookKeys.settle)).passkey;
      yield* Ref.set(server.offline, false);

      const settled = (yield* phone.run(NotebookKeys.settle)).passkey;
      yield* laptop.run(NotebookKeys.usePasskey("credential", Option.some(prf)));

      assert.deepStrictEqual(
        {
          offline,
          whileOffline,
          settled,
          opened: Option.getOrUndefined(yield* laptop.rootKey),
        },
        {
          offline: "offline",
          whileOffline: Option.some("offline"),
          settled: Option.none(),
          opened: Option.getOrUndefined(yield* phone.rootKey),
        },
      );
    }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // A new card retires the old one once the server holds it. For an account without an address
  // the new one is then the only way in, so a lost answer and a restart must not lose it.
  it.effect(
    "a new Notfallkarte waits on the device from before it goes out until the student saved it",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const laptop = yield* device(server);
        yield* phone.run(NotebookKeys.status);
        const pending = phone.run(NotebookKeys.pendingCard);

        // The server doesn't take it: it waits unseen, and no key step shows or sends it.
        yield* Ref.set(server.notFresh, true);
        const refused = yield* reasonOf(phone.run(NotebookKeys.replaceCard));
        yield* phone.run(NotebookKeys.settle);
        const waiting = yield* pending;
        yield* Ref.set(server.notFresh, false);

        // The retry sends the same card, and its answer is lost. A restart's key step finds that
        // the server holds it, and the card step shows it.
        yield* Ref.set(server.loseAnswer, true);
        const lost = yield* reasonOf(phone.run(NotebookKeys.replaceCard));
        yield* phone.run(NotebookKeys.settle);
        const shown = yield* pending;

        const sameCard =
          Option.isSome(waiting) && Option.isSome(shown)
            ? NotebookKeys.sameCard(waiting.value.code, shown.value.code)
            : false;

        yield* phone.run(NotebookKeys.cardSaved);

        if (Option.isSome(shown)) {
          yield* laptop.run(NotebookKeys.unlockWithCode(Redacted.value(shown.value.text)));
        }

        const codes = (yield* Ref.get(server.stored)).wrappers.filter(
          ({ statement }) => statement.kind === Wrapper.kindByte.code,
        );

        const flags = (card: Option.Option<NotebookKeys.PendingCard>) =>
          Option.map(card, ({ unsaved, replacing, endsAtSaved }) => ({
            unsaved,
            replacing,
            endsAtSaved,
          }));

        assert.deepStrictEqual(
          {
            refused,
            waiting: flags(waiting),
            lost,
            shown: flags(shown),
            sameCard,
            afterSaved: Option.isNone(yield* pending),
            codes: codes.length,
            opened: Option.getOrUndefined(yield* laptop.rootKey),
          },
          {
            refused: "not-fresh",
            waiting: Option.some({ unsaved: true, replacing: true, endsAtSaved: true }),
            lost: "offline",
            shown: Option.some({ unsaved: true, replacing: false, endsAtSaved: true }),
            sameCard: true,
            afterSaved: true,
            codes: 1,
            opened: Option.getOrUndefined(yield* phone.rootKey),
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  // Another device made a new card while this one still showed the old one, or held it to send.
  it.effect(
    "a card a newer one retired stops its work here: the card step says so, a saved one goes",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const tablet = yield* device(server);
        const laptop = yield* device(server);
        yield* phone.run(NotebookKeys.status);

        // The phone's new card is on the server, and the card step still shows it. The tablet,
        // unlocked and offline, holds the card the student typed there.
        const first = (yield* RecoveryCode.generate).bytes;
        const text = Redacted.value(RecoveryCode.text(first));
        yield* phone.run(Effect.andThen(fresh(first), NotebookKeys.settle));
        yield* tablet.run(NotebookKeys.unlockWithCode(text));
        yield* Ref.set(server.offline, true);
        yield* tablet.run(typed(first));
        yield* Ref.set(server.offline, false);

        // The laptop opens the notebook with it and makes a new one.
        yield* laptop.run(NotebookKeys.unlockWithCode(text));
        yield* laptop.run(createCard);

        const unsaved = (yield* phone.run(NotebookKeys.settle)).card;
        const keptForTheStep = Option.isSome(yield* phone.run(NotebookKeys.pendingCard));
        yield* phone.run(NotebookKeys.leaveCard(first));

        const saved = (yield* tablet.run(NotebookKeys.settle)).card;
        const again = (yield* tablet.run(NotebookKeys.settle)).card;

        assert.deepStrictEqual(
          {
            unsaved,
            keptForTheStep,
            afterWeiter: Option.isNone(yield* phone.run(NotebookKeys.pendingCard)),
            saved,
            again,
            tabletKeeps: Option.isNone(yield* tablet.run(NotebookKeys.pendingCard)),
          },
          {
            unsaved: Option.some("no-match"),
            keptForTheStep: true,
            afterWeiter: true,
            saved: Option.some("no-match"),
            again: Option.none(),
            tabletKeeps: true,
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );

  it.effect(
    "a new device makes no second key when the server lost the records of a sealed notebook",
    () =>
      Effect.gen(function* () {
        const server = yield* fakeServer;
        const phone = yield* device(server);
        const laptop = yield* device(server);
        yield* phone.run(NotebookKeys.status);
        const [record] = (yield* Ref.get(server.stored)).records;
        yield* Ref.set(server.sealedWith, Option.fromNullishOr(record));
        yield* Ref.set(server.stored, { records: [], wrappers: [] });
        const laptopStatus = yield* laptop.run(NotebookKeys.status);
        const recordsAfterLaptop = (yield* Ref.get(server.stored)).records.length;
        const phoneMatches = yield* phone.run(NotebookKeys.reconcile);
        const [back] = (yield* Ref.get(server.stored)).records;

        assert.deepStrictEqual(
          {
            laptopStatus: laptopStatus._tag,
            recordsAfterLaptop,
            laptopKey: Option.isNone(yield* laptop.rootKey),
            phoneMatches,
            back:
              back !== undefined &&
              record !== undefined &&
              KeyServerTesting.samePublicKeys(back, record),
          },
          {
            laptopStatus: "Locked",
            recordsAfterLaptop: 0,
            laptopKey: true,
            phoneMatches: true,
            back: true,
          },
        );
      }).pipe(Effect.scoped, Effect.provide(TestCrypto.layer("NotebookKeys.test"))),
  );
});
