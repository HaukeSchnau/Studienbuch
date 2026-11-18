import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

// How long the app waits for the server to answer one request. Sync's stream isn't one request and
// has no deadline here.

export * as Deadline from "./Deadline.ts";

/**
 * How long a request may wait for its whole answer, body included. The slowest ones wait while the
 * server hands the code's mail to the mail server, which takes seconds.
 */
export const answerWithin = Duration.seconds(30);

/**
 * Ends a request with `late` once `answerWithin` passed. A server that takes the request and never
 * answers, or stops in the middle of the body, then counts as no answer at all.
 */
export const within =
  <Late>(late: () => Late) =>
  <A, E, R>(request: Effect.Effect<A, E, R>) =>
    Effect.timeoutOrElse(request, {
      duration: answerWithin,
      orElse: () => Effect.fail(late()),
    });
