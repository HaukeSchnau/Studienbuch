import type { Keys } from "@stu/api/Keys";
import type { AccountKey } from "@stu/e2ee";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

// The `Keys` RPC group as the signed-in account. Every call needs the server, so each can fail
// with `Unreachable`. `KeysState.keyServer` calls it over HTTP; tests answer from memory.

export * as KeyServer from "./KeyServer.ts";

/** The server didn't answer: the device is offline, or the server is down. */
export class Unreachable extends Schema.TaggedError<
  Unreachable,
  { readonly brand: unique symbol }
>()("KeyServer.Unreachable", {}) {}

export class Service extends Context.Service<
  Service,
  {
    readonly state: Effect.Effect<Keys.State, Unreachable | Keys.SignedOut>;
    readonly init: (
      record: AccountKey.Record,
      wrapper: Keys.Sealed,
    ) => Effect.Effect<
      void,
      Unreachable | Keys.SignedOut | Keys.ChainExists | Keys.KeysLost | Keys.Invalid
    >;
    readonly addWrapper: (
      wrapper: Keys.Sealed,
    ) => Effect.Effect<
      void,
      Unreachable | Keys.SignedOut | Keys.Invalid | Keys.Stale | Keys.NotFresh
    >;
    readonly fetchSeals: (
      method: Keys.Method,
    ) => Effect.Effect<Keys.Seals, Unreachable | Keys.SignedOut | Keys.TooManyAttempts>;
  }
>()("KeyServer.Service") {}
