import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Account } from "./Account.ts";
import { DeletionServer } from "./DeletionServer.ts";

// "Konto löschen": the server deletes the account and ends every session, then each device forgets
// what the account left there. This one does it at once; any other does it when it next connects.

export * as Deletion from "./Deletion.ts";

export const Reason = Schema.Literals(["offline", "not-fresh", "signed-out"]);

export type Reason = typeof Reason.Type;

export class Problem extends Schema.TaggedError<Problem, { readonly brand: unique symbol }>()(
  "Deletion.Problem",
  { reason: Reason },
) {}

export const sentence: Record<Reason, string> = {
  offline:
    "Zum Löschen braucht dein Gerät eine Verbindung zum Server. Versuch es noch einmal, wenn du online bist.",
  "not-fresh": "Bestätige kurz, dass du es bist, dann geht es weiter.",
  "signed-out":
    "Deine Anmeldung ist abgelaufen. Melde dich neu an, dann kannst du dein Konto löschen.",
};

/**
 * Deletes the signed-in account on the server, then signs this device out with `forget`, as
 * "Abmelden" does. Fails with "not-fresh" when the sign-in is older than `Keys.freshSignInMinutes`.
 */
export const deleteAccount = Effect.fn("Deletion.deleteAccount")(function* <E, R>(
  forget: (signed: SessionStore.Signed) => Effect.Effect<void, E, R>,
) {
  const store = yield* SessionStore.Service;
  const server = yield* DeletionServer.Service;
  const token = Option.flatMap(yield* store.current, (signed) => signed.token);

  if (Option.isNone(token)) return yield* new Problem({ reason: "signed-out" });

  yield* server.delete(token.value).pipe(
    Effect.catchTags({
      "DeletionServer.Unreachable": () => Effect.fail(new Problem({ reason: "offline" })),
      "AccountDeletion.NotFresh": () => Effect.fail(new Problem({ reason: "not-fresh" })),
      "AccountDeletion.SignedOut": () => Effect.fail(new Problem({ reason: "signed-out" })),
    }),
  );

  yield* Account.signOut(forget);
});

/** The token of a session that just ended: the same account, a token before and none now. */
const endedToken = (
  before: Option.Option<SessionStore.Signed>,
  now: Option.Option<SessionStore.Signed>,
): Option.Option<Redacted.Redacted> =>
  Option.isSome(before) &&
  Option.isSome(now) &&
  before.value.accountId === now.value.accountId &&
  Option.isNone(now.value.token)
    ? before.value.token
    : Option.none();

/**
 * Signs the device out with `forget` when the session of its account ends because the account was
 * deleted, here, on another device or for inactivity. It asks with the token that just ended. Any
 * other end keeps the account's data until it signs in again (D27); so does a question the server
 * doesn't answer, which the next start asks again, since the device keeps the token.
 */
export const forgetWhenDeleted = Effect.fn("Deletion.forgetWhenDeleted")(function* <E, R>(
  forget: (signed: SessionStore.Signed) => Effect.Effect<void, E, R>,
) {
  const store = yield* SessionStore.Service;
  const server = yield* DeletionServer.Service;

  yield* store.changes.pipe(
    Stream.mapAccum(
      () => Option.none<SessionStore.Signed>(),
      (before, now) => [now, Option.toArray(endedToken(before, now))] as const,
    ),
    Stream.runForEach((token) =>
      server.deleted(token).pipe(
        Effect.flatMap((deleted) => (deleted ? Account.signOut(forget) : Effect.void)),
        Effect.catchTags({ "DeletionServer.Unreachable": () => Effect.void }),
      ),
    ),
  );
});
