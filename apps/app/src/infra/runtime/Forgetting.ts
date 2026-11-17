import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";

import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { DeviceSessions } from "../keychain/DeviceSessions.ts";
import { Keychain } from "../keychain/Keychain.ts";

// Sign-out deletes what an account left on this device: its database, its secrets and its
// session. A note in the keychain names the account until all three are gone. Writing it is the
// point of no return: the account's engine stays off, and a sign-out cut short finishes at the
// next start or before the next session, whichever comes first.

export * as Forgetting from "./Forgetting.ts";

const Pending = Schema.fromJsonString(Schema.Array(Schema.String));

const decodePending = Schema.decodeEffect(Pending);
const encodePending = Schema.encodeEffect(Pending);

const note = Effect.gen(function* () {
  const store = yield* Keychain.Store;
  const device = yield* Device.Service;
  const server = yield* Ports.Server;
  const entry = `forgetting.${Names.device(server.origin, device.name)}`;

  // Only `write` stores here, so a value that doesn't parse is a defect.
  const read = store.get(entry).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed<ReadonlyArray<string>>([]),
        onSome: (text) => decodePending(text).pipe(Effect.orDie),
      }),
    ),
  );

  const write = (accounts: ReadonlyArray<string>) =>
    accounts.length === 0
      ? store.remove(entry)
      : Effect.flatMap(encodePending(accounts).pipe(Effect.orDie), (text) =>
          store.set(entry, text),
        );

  return { read, write };
});

/** A sign-out failed again on retry after its point of no return. Its note stays. */
export class Unfinished extends Schema.TaggedError<Unfinished, { readonly brand: unique symbol }>()(
  "Forgetting.Unfinished",
  { cause: Schema.Defect() },
) {}

const erase = Effect.fn("Forgetting.erase")(function* <E, R>(
  accountId: string,
  removeDatabase: (accountId: string) => Effect.Effect<void, E, R>,
) {
  const device = yield* Device.Service;
  const server = yield* Ports.Server;
  const sessions = yield* DeviceSessions.Service;

  yield* removeDatabase(accountId);
  yield* Keychain.forgetSecrets(Names.secrets(server.origin, device.name, accountId));
  yield* sessions.remove(accountId);
});

/**
 * Runs the rest of a begun sign-out to its end: `steps` and then the note's line, tried again a
 * few times before it gives up, as a keychain or file system that fails once may work a moment
 * later. Every step deletes, so a second run repeats nothing that matters.
 */
const finishing = Effect.fn("Forgetting.finishing")(
  function* <E, R>(accountId: string, steps: Effect.Effect<void, E, R>) {
    const { read, write } = yield* note;

    yield* steps;
    yield* write((yield* read).filter((id) => id !== accountId));
  },
  Effect.retry({ schedule: Schedule.exponential("200 millis"), times: 3 }),
  Effect.mapError((cause) => new Unfinished({ cause })),
  Effect.uninterruptible,
);

/** The accounts whose sign-out began on this device and hasn't finished. */
export const pending = Effect.flatMap(note, ({ read }) => read);

/**
 * Signs the account out of this device: deletes its database (with `removeDatabase`, after its
 * layer closed), its secrets and its session, then runs `signedOut`. The note goes first and
 * marks the point of no return; from there the sign-out runs to its end.
 */
export const forget = Effect.fn("Forgetting.forget")(function* <E, R, E2, R2>(
  accountId: string,
  removeDatabase: (accountId: string) => Effect.Effect<void, E, R>,
  signedOut: Effect.Effect<void, E2, R2>,
) {
  const { read, write } = yield* note;

  yield* write([...new Set([...(yield* read), accountId])]);
  yield* finishing(accountId, Effect.andThen(erase(accountId, removeDatabase), signedOut));
}, Effect.uninterruptible);

/** Finishes the sign-outs a previous run left unfinished. One that fails again waits for the next. */
export const resume = Effect.fn("Forgetting.resume")(function* <E, R>(
  removeDatabase: (accountId: string) => Effect.Effect<void, E, R>,
) {
  for (const accountId of yield* pending) {
    yield* finishing(accountId, erase(accountId, removeDatabase)).pipe(
      Effect.catchCause((cause) => Effect.logWarning("A sign-out stays unfinished", cause)),
    );
  }
});

/** Finishes the sign-outs this device began and didn't finish, as before a new session. */
export class Service extends Context.Service<
  Service,
  { readonly finish: Effect.Effect<void, Unfinished | Keychain.Unavailable> }
>()("Forgetting.Service") {}

/** `Service` with `removeDatabase`, how this device deletes an account's database. */
export const layer = <E, R>(removeDatabase: (accountId: string) => Effect.Effect<void, E, R>) =>
  Layer.effect(Service)(
    Effect.map(
      Effect.context<R | Keychain.Store | Device.Service | Ports.Server | DeviceSessions.Service>(),
      (context) =>
        Service.of({
          finish: Effect.gen(function* () {
            for (const accountId of yield* pending) {
              yield* finishing(accountId, erase(accountId, removeDatabase));
            }
          }).pipe(Effect.provide(context)),
        }),
    ),
  );
