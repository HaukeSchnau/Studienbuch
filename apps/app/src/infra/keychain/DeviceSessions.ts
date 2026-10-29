import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

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
}

export class Service extends Context.Service<
  Service,
  {
    /** Every account signed in on this device. */
    readonly all: Effect.Effect<ReadonlyArray<Session>, Keychain.Unavailable>;
    readonly set: (
      accountId: string,
      token: Redacted.Redacted,
    ) => Effect.Effect<void, Keychain.Unavailable>;
    /** Removing an account that has no session succeeds. */
    readonly remove: (accountId: string) => Effect.Effect<void, Keychain.Unavailable>;
  }
>()("DeviceSessions.Service") {}

const Tokens = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

const decodeTokens = Schema.decodeEffect(Tokens);
const encodeTokens = Schema.encodeEffect(Tokens);

export const layer = Layer.effect(Service)(
  Effect.gen(function* () {
    const store = yield* Keychain.Store;
    const device = yield* Device.Service;
    const server = yield* Ports.Server;
    const entry = `sessions.${Names.device(server.origin, device.name)}`;

    // Only `write` stores here, so a value that doesn't parse is a defect.
    const read = store.get(entry).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.succeed<Record<string, string>>({}),
          onSome: (text) => decodeTokens(text).pipe(Effect.orDie),
        }),
      ),
    );

    const write = (tokens: Record<string, string>) =>
      Effect.flatMap(encodeTokens(tokens).pipe(Effect.orDie), (text) => store.set(entry, text));

    return Service.of({
      all: Effect.map(read, (tokens) =>
        Object.entries(tokens).map(([accountId, token]) => ({
          accountId,
          token: Redacted.make(token),
        })),
      ),
      set: (accountId, token) =>
        Effect.flatMap(read, (tokens) => write({ ...tokens, [accountId]: Redacted.value(token) })),
      remove: (accountId) =>
        Effect.flatMap(read, (tokens) =>
          write(Object.fromEntries(Object.entries(tokens).filter(([id]) => id !== accountId))),
        ),
    });
  }),
);
