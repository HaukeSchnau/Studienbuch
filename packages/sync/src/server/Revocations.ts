/**
 * Sessions as they are revoked, from `SessionResolver.revoked`, read by one fiber per process and
 * passed on to every connection that waits on one. A session revoked within a ticket's lifetime is
 * remembered, so a ticket issued just before the revocation opens nothing.
 */
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Stream from "effect/Stream";
import { Ports } from "./Ports.ts";

export * as Revocations from "./Revocations.ts";

/** How long a revocation is remembered: longer than a ticket lives. */
export const memory = Duration.minutes(1);

/**
 * Revocations remembered at most. An expired one leaves only when it is read again, so this bounds
 * them; past it the oldest go early, and their connections close at the next session check.
 */
const remembered = 10_000;

export class Service extends Context.Service<
  Service,
  {
    /** Whether the session was revoked lately. */
    readonly revoked: (sessionId: string) => Effect.Effect<boolean>;
    /** Completes once the session is revoked, at once if it was lately. */
    readonly revocation: (sessionId: string) => Effect.Effect<void>;
  }
>()("@stu/sync/server/Revocations") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const resolver = yield* Ports.SessionResolver;
    const revocations = yield* PubSub.unbounded<string>();

    // Only `revoke` fills it, and `has` never runs the lookup.
    const lately = yield* Cache.make({
      lookup: (_sessionId: string) => Effect.void,
      capacity: remembered,
      timeToLive: memory,
    });

    const revoke = (sessionId: string) =>
      Effect.andThen(
        Cache.set(lately, sessionId, undefined),
        PubSub.publish(revocations, sessionId),
      );

    // Subscribed before the layer is up, so no revocation slips past a starting server.
    const next = yield* Stream.toPull(resolver.revoked);
    yield* next.pipe(Effect.flatMap(Effect.forEach(revoke)), Effect.forever, Effect.forkScoped);

    const revoked = (sessionId: string) => Cache.has(lately, sessionId);

    const revocation = Effect.fn("Revocations.revocation")(function* (sessionId: string) {
      // Subscribed before the check, so a revocation between the two still arrives.
      const revoking = yield* PubSub.subscribe(revocations);

      if (yield* revoked(sessionId)) return;

      yield* Stream.fromSubscription(revoking).pipe(
        Stream.filter((each) => each === sessionId),
        Stream.runHead,
      );
    }, Effect.scoped);

    return Service.of({ revoked, revocation });
  }),
);
