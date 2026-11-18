import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { DeviceSessions } from "../../infra/keychain/DeviceSessions.ts";
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
 * Deletes the signed-in account on the server, then `leave`s it on this device by its id, which
 * acts only while the device still holds that account. Fails with "not-fresh" when the sign-in is
 * older than `Keys.freshSignInMinutes`.
 */
export const deleteAccount = Effect.fn("Deletion.deleteAccount")(function* <E, R>(
  leave: (accountId: string) => Effect.Effect<void, E, R>,
) {
  const store = yield* SessionStore.Service;
  const server = yield* DeletionServer.Service;
  const current = yield* store.current;
  const token = Option.flatMap(current, (signed) => signed.token);

  if (Option.isNone(current) || Option.isNone(token)) {
    return yield* new Problem({ reason: "signed-out" });
  }

  yield* server.delete(token.value).pipe(
    Effect.catchTags({
      "DeletionServer.Unreachable": () => Effect.fail(new Problem({ reason: "offline" })),
      "AccountDeletion.NotFresh": () => Effect.fail(new Problem({ reason: "not-fresh" })),
      // The server deleted the account before, and its answer was lost or the device couldn't
      // finish leaving: the session is gone because the account is, so the device leaves now.
      "AccountDeletion.SignedOut": () =>
        server.deleted(token.value).pipe(
          Effect.catchTags({
            "DeletionServer.Unreachable": () => Effect.fail(new Problem({ reason: "offline" })),
          }),
          Effect.flatMap((deleted) =>
            deleted ? Effect.void : Effect.fail(new Problem({ reason: "signed-out" })),
          ),
        ),
    }),
  );

  yield* leave(current.value.accountId);
});

/** An account whose session ended, and the token it ended with, if this run still knows it. */
interface Ended {
  readonly accountId: string;
  readonly token: Option.Option<Redacted.Redacted>;
}

/**
 * The account whose session has ended now, with the token this run saw it hold before. One that
 * ended before this run comes without, and the check reads the token the device stored.
 */
const endedOf = (
  before: Option.Option<SessionStore.Signed>,
  now: Option.Option<SessionStore.Signed>,
): Option.Option<Ended> =>
  Option.map(
    Option.filter(now, (signed) => Option.isNone(signed.token)),
    ({ accountId }) => ({
      accountId,
      token: Option.flatMap(
        Option.filter(before, (signed) => signed.accountId === accountId),
        (signed) => signed.token,
      ),
    }),
  );

/** A server that can't be reached is asked again, at most every five minutes. */
const askAgain = Schedule.min([Schedule.exponential("2 seconds"), Schedule.spaced("5 minutes")]);

/**
 * `leave`s the account whose session ended if the server says the account was deleted, asking
 * with the ended session's token. The question waits for a reachable server and stops once
 * another account or none holds the device. Any other end keeps the data (D27).
 */
export const forgetWhenDeleted = Effect.fn("Deletion.forgetWhenDeleted")(function* <E, R>(
  leave: (accountId: string) => Effect.Effect<void, E, R>,
) {
  const store = yield* SessionStore.Service;
  const sessions = yield* DeviceSessions.Service;
  const server = yield* DeletionServer.Service;

  const stored = (accountId: string) =>
    Effect.map(sessions.all, (all) =>
      Option.map(
        Option.fromNullishOr(all.find((session) => session.accountId === accountId)),
        (session) => session.token,
      ),
    );

  const check = Effect.fn("Deletion.check")(
    function* ({ accountId, token }: Ended) {
      const asked = Option.isSome(token) ? token : yield* stored(accountId);

      if (Option.isNone(asked)) return;

      const deleted = yield* server.deleted(asked.value).pipe(Effect.retry({ schedule: askAgain }));

      if (deleted) yield* Effect.uninterruptible(leave(accountId));
    },
    Effect.catchCause((cause) =>
      Effect.logWarning("A device of a deleted account didn't forget it yet", cause),
    ),
  );

  yield* store.changes.pipe(
    Stream.mapAccum(
      () => Option.none<SessionStore.Signed>(),
      (before, now) => [now, [endedOf(before, now)]] as const,
    ),
    Stream.changesWith((a, b) =>
      Equal.equals(
        Option.map(a, (ended) => ended.accountId),
        Option.map(b, (ended) => ended.accountId),
      ),
    ),
    Stream.switchMap((ended) =>
      Option.match(ended, {
        onNone: () => Stream.empty,
        onSome: (each) => Stream.fromEffect(check(each)),
      }),
    ),
    Stream.runDrain,
  );
});
