import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { Keychain } from "./Keychain.ts";

// The bearer tokens of the accounts signed in on this device, and the Notfallkarte of a sign-up
// whose session is still to come. They are the secrets the app reads before it knows the account,
// so they sit in the device's namespace, while everything else an account keeps is in its own
// (Names.secrets).

export * as DeviceSessions from "./DeviceSessions.ts";

export interface Session {
  readonly accountId: string;
  readonly token: Redacted.Redacted;
  /** Signed in with a password at a demo account's address, as a persona (`Demo.isDemoSignIn`). */
  readonly demo: boolean;
}

export class Service extends Context.Service<
  Service,
  {
    /** Every account signed in on this device. */
    readonly all: Effect.Effect<ReadonlyArray<Session>, Keychain.Unavailable>;
    /** Keeps a session, which takes the place of a staged card (`stage`). */
    readonly set: (session: Session) => Effect.Effect<void, Keychain.Unavailable>;
    /** Removes the account's session and a staged card. An account that has none succeeds. */
    readonly remove: (accountId: string) => Effect.Effect<void, Keychain.Unavailable>;
    /** The card of a card-first sign-up whose session the device doesn't hold yet. */
    readonly staged: Effect.Effect<
      Option.Option<Redacted.Redacted<Uint8Array>>,
      Keychain.Unavailable
    >;
    /**
     * Stages a sign-up's card before its request goes out: the server may make the account and
     * lose its answer, and the card is then its only way in. A kept session or a sign-out removes
     * it, and a public computer's sign-up moves it into the tab's memory (`unstage`).
     */
    readonly stage: (
      code: Redacted.Redacted<Uint8Array>,
    ) => Effect.Effect<void, Keychain.Unavailable>;
    /** Drops a staged card the device still holds beside a session, as after a run that stopped. */
    readonly tidy: Effect.Effect<void, Keychain.Unavailable>;
    /** Removes a staged card, as a public computer's sign-up does when it takes it into memory. */
    readonly unstage: Effect.Effect<void, Keychain.Unavailable>;
  }
>()("DeviceSessions.Service") {}

const Tokens = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));
const AccountIds = Schema.fromJsonString(Schema.Array(Schema.String));
const decodeCard = Schema.decodeEffect(Schema.Uint8ArrayFromBase64);

export const layer = Layer.effect(Service)(
  Effect.gen(function* () {
    const store = yield* Keychain.Store;
    const device = yield* Device.Service;
    const server = yield* Ports.Server;
    const name = Names.device(server.origin, device.name);

    // Only `set` and `remove` write an entry, so a value that doesn't parse is a defect.
    const entry = <A>(key: string, schema: Schema.Codec<A, string>, empty: A) => {
      const decode = Schema.decodeEffect(schema);
      const encode = Schema.encodeEffect(schema);

      return {
        read: store.get(key).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.succeed(empty),
              onSome: (text) => decode(text).pipe(Effect.orDie),
            }),
          ),
        ),
        write: (value: A) =>
          Effect.flatMap(encode(value).pipe(Effect.orDie), (text) => store.set(key, text)),
      };
    };

    const tokens = entry<Record<string, string>>(`sessions.${name}`, Tokens, {});
    // An entry of its own, so the app one release back still reads the tokens.
    const demoAccounts = entry<ReadonlyArray<string>>(`demo-sessions.${name}`, AccountIds, []);
    const cardEntry = `sign-up-card.${name}`;

    const card = {
      // Only `stage` writes here, so a value that isn't base64 is a defect.
      read: store.get(cardEntry).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeedNone,
            onSome: (text) => Effect.asSome(decodeCard(text).pipe(Effect.orDie)),
          }),
        ),
      ),
      remove: store.remove(cardEntry),
    };

    // `set` and `remove` read, change and write whole entries, one at a time.
    const writer = yield* Semaphore.make(1);

    // The session is kept by now, so this must not fail. A card left here is no sign-up's while
    // the device holds a session, and `remove` or the next start's `tidy` drops it.
    const unstaged = card.remove.pipe(
      Effect.catchTags({
        "Keychain.Unavailable": (error) =>
          Effect.logWarning("A sign-up's card stays until the next start", error),
      }),
    );

    const set = Effect.fn("DeviceSessions.set")(function* ({ accountId, token, demo }: Session) {
      const others = (yield* demoAccounts.read).filter((id) => id !== accountId);

      yield* demoAccounts.write(demo ? [...others, accountId] : others);
      yield* tokens.write({ ...(yield* tokens.read), [accountId]: Redacted.value(token) });
      yield* unstaged;
    }, Semaphore.withPermit(writer));

    // The card goes first: a sign-out that fails here keeps its note and finishes before the
    // next session, and a sign-up stages in that turn too (`Forgetting.Service`).
    const remove = Effect.fn("DeviceSessions.remove")(function* (accountId: string) {
      yield* card.remove;

      const kept = Object.entries(yield* tokens.read).filter(([id]) => id !== accountId);

      yield* tokens.write(Object.fromEntries(kept));
      yield* demoAccounts.write((yield* demoAccounts.read).filter((id) => id !== accountId));
    }, Semaphore.withPermit(writer));

    return Service.of({
      all: Effect.gen(function* () {
        const demo = new Set(yield* demoAccounts.read);

        return Object.entries(yield* tokens.read).map(([accountId, token]) => ({
          accountId,
          token: Redacted.make(token),
          demo: demo.has(accountId),
        }));
      }),
      set,
      remove,
      staged: Effect.map(card.read, Option.map(Redacted.make)),
      stage: (code) => writer.withPermit(store.set(cardEntry, Base64.encode(Redacted.value(code)))),
      unstage: writer.withPermit(card.remove),
      tidy: writer.withPermit(
        Effect.flatMap(tokens.read, (held) =>
          Object.keys(held).length === 0 ? Effect.void : card.remove,
        ),
      ),
    });
  }),
);

/**
 * The start's step after a run that stopped between keeping a session and dropping the card it
 * staged. A keychain that refuses now leaves the card to sign-out, and to the next start.
 */
export const tidy = Effect.flatMap(Service, (sessions) => sessions.tidy).pipe(
  Effect.catchTags({
    "Keychain.Unavailable": (error) =>
      Effect.logWarning("A sign-up's card stays until the next start", error),
  }),
);
