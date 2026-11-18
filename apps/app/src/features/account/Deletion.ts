import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { DeletionServer } from "./DeletionServer.ts";

// "Konto löschen": the server deletes the account and ends every session, then each device forgets
// what the account left there. This one does it at once; any other does it when it next connects.

export * as Deletion from "./Deletion.ts";

export const Reason = Schema.Literals(["offline", "not-fresh", "signed-out", "forget-failed"]);

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
  "forget-failed":
    "Dein Konto ist gelöscht. Dieses Gerät konnte seine Kopie noch nicht ganz entfernen und versucht es beim nächsten Start noch einmal.",
};

/**
 * Deletes the signed-in account on the server, then leaves this device with `leave`, which forgets
 * everything the account left here as sign-out does. Fails with "not-fresh" when the sign-in is
 * older than `Keys.freshSignInMinutes`.
 */
export const deleteAccount = Effect.fn("Deletion.deleteAccount")(function* <E, R>(
  leave: Effect.Effect<void, E, R>,
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

  yield* leave;
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
 * Runs `leave` when the account's session ends because the account was deleted, asking with the
 * token that just ended. Any other end keeps the data until it signs in again (D27). An unanswered
 * question or a failed `leave` waits for the next start, since the device keeps the token.
 */
export const forgetWhenDeleted = Effect.fn("Deletion.forgetWhenDeleted")(function* <E, R>(
  leave: Effect.Effect<void, E, R>,
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
        Effect.flatMap((deleted) => (deleted ? leave : Effect.void)),
        Effect.catchCause((cause) =>
          Effect.logWarning("A device of a deleted account didn't forget it yet", cause),
        ),
      ),
    ),
  );
});
