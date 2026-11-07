import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// Where a sign-up waits for its address's confirmation, so a reload or the OS ending the app comes
// back to the code: a phone's keychain, and in a browser the tab's sessionStorage, which goes with
// the tab. Neither reaches another device. `signUpStore.ts` and `signUpStore.web.ts` provide it.

export * as PendingSignUp from "./PendingSignUp.ts";

/** One text entry: the sign-up `Account` keeps, never its password. */
export class Store extends Context.Service<
  Store,
  {
    readonly get: Effect.Effect<Option.Option<string>, Unavailable>;
    readonly set: (text: string) => Effect.Effect<void, Unavailable>;
    /** Removing what isn't there succeeds. */
    readonly remove: Effect.Effect<void, Unavailable>;
  }
>()("PendingSignUp.Store") {}

export class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("PendingSignUp.Unavailable", { cause: Schema.Defect() }) {}
