/**
 * Sessions as they are revoked, from `SessionResolver.revoked`, read by one fiber per process. A
 * session revoked within a ticket's lifetime is remembered, so a ticket issued just before the
 * revocation opens nothing.
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

/** Revocations remembered at most, far above a minute's worth. Past it the oldest goes first. */
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
    const published = yield* PubSub.unbounded<string>();

    // Entries only ever arrive through `Cache.set`, so the lookup never runs.
    const lately = yield* Cache.make<string, true>({
      lookup: (_sessionId: string) => Effect.die("Revocations are set, never looked up"),
      capacity: remembered,
      timeToLive: memory,
    });

    const revoke = (session: string) =>
      Effect.andThen(Cache.set(lately, session, true), PubSub.publish(published, session));

    // Subscribed before the layer is up, so no revocation slips past a starting server. The stream
    // ends only with its adapter, as the server shuts down.
    const pull = yield* Stream.toPull(resolver.revoked);

    yield* Effect.forever(
      Effect.flatMap(pull, (sessions) => Effect.forEach(sessions, revoke)),
    ).pipe(Effect.ignore, Effect.forkScoped);

    const revoked = (session: string) => Cache.has(lately, session);

    const revocation = Effect.fn("Revocations.revocation")(function* (session: string) {
      const subscription = yield* PubSub.subscribe(published);

      if (yield* revoked(session)) return;
      yield* PubSub.take(subscription).pipe(Effect.repeat({ until: (each) => each === session }));
    }, Effect.scoped);

    return Service.of({ revoked, revocation });
  }),
);
