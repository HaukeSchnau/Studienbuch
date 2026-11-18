import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
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
 * Writes the account into the note: the sign-out's point of no return. From here its engine stays
 * off, and the sign-out finishes in this run (`end`), before the next session or at the next start.
 */
export const begin = Effect.fn("Forgetting.begin")(function* (accountId: string) {
  const { read, write } = yield* note;

  yield* write([...new Set([...(yield* read), accountId])]);
});

/**
 * Runs a begun sign-out to its end: deletes the account's database (with `removeDatabase`, after
 * its layer closed), its secrets and its session, then runs `signedOut`, and takes the account
 * off the note.
 */
export const end = Effect.fn("Forgetting.end")(function* <E, R, E2, R2>(
  accountId: string,
  removeDatabase: (accountId: string) => Effect.Effect<void, E, R>,
  signedOut: Effect.Effect<void, E2, R2>,
) {
  yield* finishing(accountId, Effect.andThen(erase(accountId, removeDatabase), signedOut));
});

/** `begin` and `end` in one, for a sign-out with no engine to stop first. */
export const forget = Effect.fn("Forgetting.forget")(function* <E, R, E2, R2>(
  accountId: string,
  removeDatabase: (accountId: string) => Effect.Effect<void, E, R>,
  signedOut: Effect.Effect<void, E2, R2>,
) {
  yield* begin(accountId);
  yield* end(accountId, removeDatabase, signedOut);
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

/** Finishes the sign-outs this device began and didn't finish, or fails as the first that fails. */
export const finish = Effect.fn("Forgetting.finish")(function* <E, R>(
  removeDatabase: (accountId: string) => Effect.Effect<void, E, R>,
) {
  for (const accountId of yield* pending) {
    yield* finishing(accountId, erase(accountId, removeDatabase));
  }
});

/**
 * Keeps a new session: `keep` runs `session` once no sign-out runs and none is left unfinished, so
 * no sign-out can delete what the new session stores.
 */
export class Service extends Context.Service<
  Service,
  {
    readonly keep: <A, E, R>(
      session: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | Unfinished | Keychain.Unavailable, R>;
  }
>()("Forgetting.Service") {}
