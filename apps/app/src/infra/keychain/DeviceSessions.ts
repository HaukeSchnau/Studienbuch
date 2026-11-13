import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { Keychain } from "./Keychain.ts";

// The bearer tokens of the accounts signed in on this device. They are the one secret the app
// reads before it knows the account, so they sit in the device's namespace, keyed by account,
// while everything else an account keeps is in its own (Names.secrets).

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
    readonly set: (session: Session) => Effect.Effect<void, Keychain.Unavailable>;
    /** Removing an account that has no session succeeds. */
    readonly remove: (accountId: string) => Effect.Effect<void, Keychain.Unavailable>;
  }
>()("DeviceSessions.Service") {}

const Tokens = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));
const AccountIds = Schema.fromJsonString(Schema.Array(Schema.String));

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

    // `set` and `remove` read, change and write whole entries, one at a time.
    const writer = yield* Semaphore.make(1);

    const set = Effect.fn("DeviceSessions.set")(function* ({ accountId, token, demo }: Session) {
      const others = (yield* demoAccounts.read).filter((id) => id !== accountId);

      yield* demoAccounts.write(demo ? [...others, accountId] : others);
      yield* tokens.write({ ...(yield* tokens.read), [accountId]: Redacted.value(token) });
    }, Semaphore.withPermit(writer));

    const remove = Effect.fn("DeviceSessions.remove")(function* (accountId: string) {
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
    });
  }),
);
