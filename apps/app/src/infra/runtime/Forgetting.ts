import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { DeviceSessions } from "../keychain/DeviceSessions.ts";
import { Keychain } from "../keychain/Keychain.ts";

// Sign-out deletes what an account left on this device: its database, its secrets and its
// session. A note in the keychain names the account until all three are gone, so a sign-out that
// the app's end cut short finishes at the next start, before anyone signs in.

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
 * Deletes the account's database (with `removeDatabase`, after its layer closed), its secrets and
 * its session.
 */
export const forget = Effect.fn("Forgetting.forget")(function* <E, R>(
  accountId: string,
  removeDatabase: (accountId: string) => Effect.Effect<void, E, R>,
) {
  const { read, write } = yield* note;

  yield* write([...new Set([...(yield* read), accountId])]);
  yield* erase(accountId, removeDatabase);
  yield* write((yield* read).filter((id) => id !== accountId));
});

/** Finishes the sign-outs a previous run left unfinished. One that fails again waits for the next. */
export const resume = Effect.fn("Forgetting.resume")(function* <E, R>(
  removeDatabase: (accountId: string) => Effect.Effect<void, E, R>,
) {
  const { read, write } = yield* note;

  for (const accountId of yield* read) {
    yield* erase(accountId, removeDatabase).pipe(
      Effect.andThen(
        Effect.flatMap(read, (accounts) => write(accounts.filter((id) => id !== accountId))),
      ),
      Effect.catchCause((cause) => Effect.logWarning("A sign-out stays unfinished", cause)),
    );
  }
});
