import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

// "Konto löschen": the signed-in account deletes itself (Art. 17 DSGVO), and a device whose
// session ended learns whether that was the reason, so it wipes itself too.

export * as AccountDeletion from "./AccountDeletion.ts";

/** The request carries no valid session. */
export class SignedOut extends Schema.TaggedError<SignedOut, { readonly brand: unique symbol }>()(
  "AccountDeletion.SignedOut",
  {},
) {}

/** Deleting needs a sign-in in the last `Keys.freshSignInMinutes`, as a new passkey does. */
export class NotFresh extends Schema.TaggedError<NotFresh, { readonly brand: unique symbol }>()(
  "AccountDeletion.NotFresh",
  {},
) {}

export const Rpcs = RpcGroup.make(
  /**
   * Deletes the account of the request's session with everything the server keeps of it, and
   * ends the sessions of all its devices.
   */
  Rpc.make("AccountDeletion.delete", { error: Schema.Union([SignedOut, NotFresh]) }),
  /**
   * Whether the request's bearer token belonged to an account that was deleted. A device asks once
   * its session ended, with the token it still holds, and wipes itself on `true`.
   */
  Rpc.make("AccountDeletion.deleted", { success: Schema.Boolean }),
);
