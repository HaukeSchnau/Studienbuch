import type { AccountDeletion } from "@stu/api/AccountDeletion";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

// The `AccountDeletion` RPC group with the token each call names: the session's own for "Konto
// löschen", and an ended session's to ask why it ended. `AccountState` calls it over HTTP; tests
// answer from memory.

export * as DeletionServer from "./DeletionServer.ts";

/** The server didn't answer: the device is offline, or the server is down. */
export class Unreachable extends Schema.TaggedError<
  Unreachable,
  { readonly brand: unique symbol }
>()("DeletionServer.Unreachable", {}) {}

export class Service extends Context.Service<
  Service,
  {
    readonly delete: (
      token: Redacted.Redacted,
    ) => Effect.Effect<void, Unreachable | AccountDeletion.SignedOut | AccountDeletion.NotFresh>;
    /** Whether the token's account was deleted. */
    readonly deleted: (token: Redacted.Redacted) => Effect.Effect<boolean, Unreachable>;
  }
>()("DeletionServer.Service") {}
