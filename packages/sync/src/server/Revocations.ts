/**
 * Sessions as they are revoked, from `SessionResolver.revoked`, read by one fiber per process that
 * starts again when the stream fails or ends. A session revoked within a ticket's lifetime is
 * remembered, so a ticket issued just before the revocation opens nothing.
 */
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as Stream from "effect/Stream";
import { Ports } from "./Ports.ts";

export * as Revocations from "./Revocations.ts";

/** How long a revocation is remembered: longer than a ticket lives. */
export const memory = Duration.minutes(1);

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
    const lately = new Map<string, number>();
    const watchers = new Map<string, Set<Deferred.Deferred<void>>>();

    const forget = Effect.map(Clock.currentTimeMillis, (now) => {
      for (const [session, at] of lately) {
        if (now - at > Duration.toMillis(memory)) lately.delete(session);
      }
    });

    const revoke = Effect.fnUntraced(function* (session: string) {
      lately.set(session, yield* Clock.currentTimeMillis);
      yield* Effect.forEach(watchers.get(session) ?? [], (watcher) =>
        Deferred.succeed(watcher, undefined),
      );
    });

    const reading = yield* Deferred.make<void>();

    // Subscribed before the layer is up, so no revocation slips past a starting server.
    yield* Effect.scoped(
      Effect.gen(function* () {
        const pull = yield* Stream.toPull(resolver.revoked);
        yield* Deferred.succeed(reading, undefined);

        return yield* Effect.forever(
          Effect.flatMap(pull, (sessions) => Effect.forEach(sessions, revoke)),
        );
      }),
    ).pipe(
      Effect.catchCauseIf(
        (cause) => !Cause.hasInterruptsOnly(cause),
        (cause) => Effect.logWarning("The revoked sessions' stream stopped", cause),
      ),
      Effect.repeat(Schedule.spaced("1 second")),
      Effect.forkScoped,
    );

    yield* Deferred.await(reading);

    yield* forget.pipe(Effect.repeat(Schedule.spaced(memory)), Effect.forkScoped);

    const revoked = (session: string) =>
      Effect.map(Clock.currentTimeMillis, (now) => {
        const at = lately.get(session);

        return at !== undefined && now - at <= Duration.toMillis(memory);
      });

    const revocation = Effect.fn("Revocations.revocation")(function* (session: string) {
      const watcher = yield* Deferred.make<void>();

      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const sessions = watchers.get(session) ?? new Set();
          sessions.add(watcher);
          watchers.set(session, sessions);
        }),
        () =>
          Effect.sync(() => {
            const sessions = watchers.get(session);
            sessions?.delete(watcher);

            if (sessions?.size === 0) watchers.delete(session);
          }),
      );

      if (yield* revoked(session)) return;
      yield* Deferred.await(watcher);
    }, Effect.scoped);

    return Service.of({ revoked, revocation });
  }),
);
